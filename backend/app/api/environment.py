"""
SwasthyaScan AI — Environment API
====================================
All environment, patient, and doctor endpoints.

Auth header: X-Session-Token: <raw_token>

Endpoints:
  POST /api/env/create               → doctor creates environment
  POST /api/env/doctor-login         → doctor logs in (returns session token)
  GET  /api/env/{env_id}/info        → public: code valid? expiry? (no auth)
  POST /api/env/{env_id}/join        → patient joins (rate-limited)
  POST /api/env/{env_id}/submit      → patient submits X-ray + questionnaire
  GET  /api/env/{env_id}/status/{sub_id} → patient polls own submission status
  GET  /api/env/{env_id}/submissions → doctor: list all submissions (queue)
  GET  /api/env/{env_id}/submission/{sub_id} → doctor: full detail
  POST /api/env/{env_id}/submission/{sub_id}/review → doctor: notes/override/status
  POST /api/env/{env_id}/submission/{sub_id}/release → doctor: release guidance note
  GET  /api/env/{env_id}/image/{sub_id} → doctor: serve image (auth required)
  POST /api/env/{env_id}/close       → doctor: close join code
  POST /api/env/{env_id}/regenerate  → doctor: regenerate join code
  DELETE /api/env/{env_id}           → doctor: delete environment + all data
"""
from __future__ import annotations

import json
import logging
import os
from typing import Optional

from fastapi import APIRouter, File, Form, Header, HTTPException, Request, UploadFile, status
from fastapi.responses import Response

from app.core.config import settings
from app.db.database import get_con
from app.schemas.screening import SymptomData
from app.services import model_service
from app.services.auth_service import (
    create_session, expires_str, generate_join_code,
    generate_session_token, get_session, hash_passcode,
    hash_token, is_expired, new_environment_id,
    new_submission_id, utcnow_str, verify_passcode,
)
from app.services.image_service import validate_image
from app.services.priority_service import compute_priority
from app.services.rate_limit_service import check_rate_limit, record_attempt
from app.services.reliability import run_reliability_engine
from app.services.retention_service import delete_environment_now
from app.services.upload_service import delete_image, load_image_bytes, save_image

router = APIRouter(prefix="/api/env", tags=["environment"])
logger = logging.getLogger(__name__)

_ENV_EXPIRY_HOURS = float(os.environ.get("ENVIRONMENT_EXPIRY_HOURS", "24"))
_DOCTOR_SESSION_HOURS = 8.0
_PATIENT_SESSION_HOURS = 48.0

# Pseudonym: no PII. Block anything that looks like a phone/email/name with spaces.
_MAX_PSEUDONYM_LEN = 32
_MIN_PSEUDONYM_LEN = 2


# ─── Auth helpers ─────────────────────────────────────────────────────────────

def _require_doctor(env_id: str, token: str | None) -> dict:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session token required.")
    th = hash_token(token)
    with get_con() as con:
        sess = get_session(con, th)
    if not sess:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session.")
    if sess["role"] != "doctor":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Doctor access required.")
    if sess["environment_id"] != env_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Token does not belong to this environment.")
    if is_expired(sess["expires_at"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session has expired.")
    return sess


def _require_patient(env_id: str, sub_id: str, token: str | None) -> dict:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session token required.")
    th = hash_token(token)
    with get_con() as con:
        sess = get_session(con, th)
    if not sess:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session.")
    if sess["role"] != "patient":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Patient access only.")
    if sess["environment_id"] != env_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Token does not belong to this environment.")
    if sess.get("submission_id") and sess["submission_id"] != sub_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only view your own submission.")
    if is_expired(sess["expires_at"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session has expired.")
    return sess


def _get_env(env_id: str):
    with get_con() as con:
        row = con.execute("SELECT * FROM environments WHERE id=?", (env_id,)).fetchone()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Environment not found.")
    return dict(row)


def _validate_pseudonym(pseudonym: str) -> str:
    p = pseudonym.strip()
    if len(p) < _MIN_PSEUDONYM_LEN:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Pseudonym must be at least {_MIN_PSEUDONYM_LEN} characters.")
    if len(p) > _MAX_PSEUDONYM_LEN:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Pseudonym must be at most {_MAX_PSEUDONYM_LEN} characters.")
    # Reject anything with @ (email) or spaces around digits (phone patterns)
    if "@" in p or p.replace(" ", "").isdigit():
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Pseudonym must not be an email address or phone number.")
    return p


# ─── Doctor: create environment ───────────────────────────────────────────────

@router.post("/create", summary="Doctor: create a new screening environment")
async def create_environment(
    passcode: str = Form(..., description="Doctor passcode (never stored in plain text)"),
):
    if len(passcode) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Passcode must be at least 8 characters.")

    env_id    = new_environment_id()
    join_code = generate_join_code()
    ph, salt  = hash_passcode(passcode)
    now       = utcnow_str()
    exp       = expires_str(_ENV_EXPIRY_HOURS)

    with get_con() as con:
        con.execute(
            """INSERT INTO environments
               (id, join_code, passcode_hash, passcode_salt, created_at, expires_at, closed)
               VALUES (?,?,?,?,?,?,0)""",
            (env_id, join_code, ph, salt, now, exp),
        )
        raw_token, token_hash = generate_session_token()
        create_session(con, token_hash, "doctor", env_id, None, _DOCTOR_SESSION_HOURS)

    logger.info("Environment created: id=%s expiry=%s", env_id, exp)
    return {
        "environment_id": env_id,
        "join_code": join_code,
        "expires_at": exp,
        "session_token": raw_token,
        "session_expires_hours": _DOCTOR_SESSION_HOURS,
    }


# ─── Doctor: login ────────────────────────────────────────────────────────────

@router.post("/{env_id}/doctor-login", summary="Doctor: authenticate to an existing environment")
async def doctor_login(
    env_id: str,
    passcode: str = Form(...),
):
    env = _get_env(env_id)
    if is_expired(env["expires_at"]):
        raise HTTPException(status.HTTP_410_GONE, "This environment has expired.")

    if not verify_passcode(passcode, env["passcode_hash"], env["passcode_salt"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect passcode.")

    with get_con() as con:
        raw_token, token_hash = generate_session_token()
        create_session(con, token_hash, "doctor", env_id, None, _DOCTOR_SESSION_HOURS)

    return {
        "environment_id": env_id,
        "join_code": env["join_code"],
        "expires_at": env["expires_at"],
        "closed": bool(env["closed"]),
        "session_token": raw_token,
    }


# ─── Public: environment info (for patient join page) ─────────────────────────

@router.get("/{env_id}/info", summary="Public: check if environment is valid and open")
async def env_info(env_id: str):
    with get_con() as con:
        row = con.execute(
            "SELECT expires_at, closed FROM environments WHERE id=?", (env_id,)
        ).fetchone()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Environment not found.")
    if is_expired(row["expires_at"]):
        raise HTTPException(status.HTTP_410_GONE, "This environment has expired.")
    if row["closed"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This environment is closed.")
    return {"valid": True, "expires_at": row["expires_at"]}


# ─── Patient: join environment ────────────────────────────────────────────────

@router.post("/{env_id}/join", summary="Patient: join environment with join code + pseudonym")
async def patient_join(
    env_id: str,
    request: Request,
    join_code: str = Form(...),
    pseudonym: str = Form(...),
):
    ip = request.client.host if request.client else "unknown"
    allowed, err = check_rate_limit(ip, join_code)
    if not allowed:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, err)

    with get_con() as con:
        env = con.execute("SELECT * FROM environments WHERE id=?", (env_id,)).fetchone()

    if not env or env["join_code"].upper() != join_code.upper():
        record_attempt(ip, join_code, success=False)
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid join code.")

    if is_expired(env["expires_at"]):
        record_attempt(ip, join_code, success=False)
        raise HTTPException(status.HTTP_410_GONE, "This environment has expired.")

    if env["closed"]:
        record_attempt(ip, join_code, success=False)
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This environment is closed.")

    pseudonym = _validate_pseudonym(pseudonym)
    record_attempt(ip, join_code, success=True)

    # Create submission placeholder
    sub_id = new_submission_id()
    now    = utcnow_str()
    with get_con() as con:
        con.execute(
            """INSERT INTO submissions
               (id, environment_id, pseudonym, created_at, priority_label, status)
               VALUES (?,?,?,?,?,?)""",
            (sub_id, env_id, pseudonym, now, "Unable to assess", "Pending"),
        )
        raw_token, token_hash = generate_session_token()
        create_session(con, token_hash, "patient", env_id, sub_id, _PATIENT_SESSION_HOURS)

    return {
        "submission_id": sub_id,
        "session_token": raw_token,
        "pseudonym": pseudonym,
        "environment_expires_at": env["expires_at"],
    }


# ─── Patient: submit X-ray + questionnaire ────────────────────────────────────

@router.post("/{env_id}/submit", summary="Patient: submit X-ray and questionnaire")
async def patient_submit(
    env_id: str,
    submission_id: str = Form(...),
    symptoms: str = Form(default="{}"),
    image: UploadFile = File(...),
    x_session_token: Optional[str] = Header(None),
):
    sess = _require_patient(env_id, submission_id, x_session_token)

    ALLOWED = {"image/jpeg", "image/jpg", "image/png"}
    if image.content_type and image.content_type not in ALLOWED:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Please upload a JPEG or PNG image.")

    data = await image.read()
    await image.close()
    filename_orig = image.filename or "upload"

    val = validate_image(data=data, filename=filename_orig,
                         max_size_bytes=settings.max_upload_size_bytes)
    if not val.valid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Image validation failed: {val.rejection_reason}")

    # Parse questionnaire
    try:
        q_raw = json.loads(symptoms) if symptoms.strip() else {}
    except json.JSONDecodeError:
        q_raw = {}

    # Run inference via existing reliability engine
    response = run_reliability_engine(
        image_validation=val,
        symptoms=SymptomData(**{
            _CAMEL_MAP.get(k, k): v for k, v in q_raw.items()
        }),
        model_configured=settings.model_configured,
        image_bytes=data,
    )

    model_out    = response.model_output
    rel_flags    = response.reliability_flags or []
    gradcam_data = response.gradcam_heatmap

    model_out_dict   = model_out.model_dump() if model_out else None
    rel_flags_list   = [f.model_dump() for f in rel_flags]

    # Compute priority
    priority = compute_priority(
        questionnaire=q_raw,
        model_output=model_out_dict,
        reliability_flags=rel_flags_list,
    )

    # Save image (EXIF stripped, random filename)
    img_filename = save_image(data)

    with get_con() as con:
        con.execute(
            """UPDATE submissions SET
               image_filename=?, questionnaire_json=?, model_output_json=?,
               reliability_flags_json=?, gradcam_data=?,
               priority_label=?, priority_reasons=?, status=?
               WHERE id=?""",
            (
                img_filename,
                json.dumps(q_raw),
                json.dumps(model_out_dict) if model_out_dict else None,
                json.dumps(rel_flags_list),
                gradcam_data,
                priority.label,
                json.dumps(priority.reasons),
                "Pending",
                submission_id,
            ),
        )

    logger.info("Submission received: env=%s sub=%s priority=%s",
                env_id, submission_id, priority.label)
    return {
        "submission_id": submission_id,
        "status": "Pending",
        "message": "Your submission has been received and will be reviewed by a doctor.",
    }


_CAMEL_MAP = {
    "persistentCough": "persistent_cough",
    "nightSweats":     "night_sweats",
    "weightLoss":      "weight_loss",
    "coughDuration":   "cough_duration",
    "additionalNotes": "additional_notes",
}


# ─── Patient: poll own submission status ──────────────────────────────────────

@router.get("/{env_id}/status/{sub_id}", summary="Patient: poll own submission status")
async def patient_status(
    env_id: str,
    sub_id: str,
    x_session_token: Optional[str] = Header(None),
):
    _require_patient(env_id, sub_id, x_session_token)
    with get_con() as con:
        row = con.execute(
            "SELECT status, released_guidance FROM submissions WHERE id=? AND environment_id=?",
            (sub_id, env_id),
        ).fetchone()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found.")
    return {
        "status": row["status"],
        "released_guidance": row["released_guidance"],
    }


# ─── Doctor: list submissions ─────────────────────────────────────────────────

@router.get("/{env_id}/submissions", summary="Doctor: get all submissions (queue)")
async def list_submissions(
    env_id: str,
    status_filter: Optional[str] = None,
    x_session_token: Optional[str] = Header(None),
):
    _require_doctor(env_id, x_session_token)
    _PRIORITY_ORDER = {
        "Urgent review": 0, "Elevated review": 1,
        "Routine review": 2, "Unable to assess": 3,
    }
    with get_con() as con:
        query = """SELECT id, pseudonym, priority_label, status, created_at,
                          override_label, released_guidance
                   FROM submissions WHERE environment_id=?"""
        params: list = [env_id]
        if status_filter:
            query += " AND status=?"
            params.append(status_filter)
        query += " ORDER BY created_at ASC"
        rows = con.execute(query, params).fetchall()

    items = [dict(r) for r in rows]
    items.sort(key=lambda x: _PRIORITY_ORDER.get(x["priority_label"], 99))
    counts = {"total": len(items)}
    for s in ("Pending", "Reviewed", "Follow-up needed"):
        counts[s.lower().replace(" ", "_")] = sum(1 for x in items if x["status"] == s)
    return {"submissions": items, "counts": counts}


# ─── Doctor: submission detail ────────────────────────────────────────────────

@router.get("/{env_id}/submission/{sub_id}", summary="Doctor: full submission detail")
async def submission_detail(
    env_id: str,
    sub_id: str,
    x_session_token: Optional[str] = Header(None),
):
    _require_doctor(env_id, x_session_token)
    with get_con() as con:
        row = con.execute(
            """SELECT id, pseudonym, questionnaire_json, model_output_json,
                      reliability_flags_json, priority_label, priority_reasons,
                      override_label, override_reason, doctor_notes, status,
                      released_guidance, created_at, image_filename
               FROM submissions WHERE id=? AND environment_id=?""",
            (sub_id, env_id),
        ).fetchone()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found.")

    d = dict(row)
    d["has_image"]           = bool(d.pop("image_filename"))
    d["questionnaire"]       = _safe_json(d.pop("questionnaire_json"))
    d["model_output"]        = _safe_json(d.pop("model_output_json"))
    d["reliability_flags"]   = _safe_json(d.pop("reliability_flags_json")) or []
    d["priority_reasons"]    = _safe_json(d.get("priority_reasons")) or []
    d["model_verified"]      = os.environ.get("MODEL_VERIFIED", "false").lower() == "true"
    return d


def _safe_json(s):
    if not s:
        return None
    try:
        return json.loads(s)
    except Exception:
        return None


# ─── Doctor: serve image ──────────────────────────────────────────────────────

@router.get("/{env_id}/image/{sub_id}", summary="Doctor: serve scan image (auth required)")
async def get_image(
    env_id: str,
    sub_id: str,
    x_session_token: Optional[str] = Header(None),
):
    _require_doctor(env_id, x_session_token)
    with get_con() as con:
        row = con.execute(
            "SELECT image_filename, gradcam_data FROM submissions WHERE id=? AND environment_id=?",
            (sub_id, env_id),
        ).fetchone()
    if not row or not row["image_filename"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found.")
    try:
        img_bytes = load_image_bytes(row["image_filename"])
    except FileNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image file has been deleted.")
    return Response(content=img_bytes, media_type="image/png",
                    headers={"Cache-Control": "no-store"})


@router.get("/{env_id}/gradcam/{sub_id}", summary="Doctor: serve Grad-CAM image (auth required)")
async def get_gradcam(
    env_id: str,
    sub_id: str,
    x_session_token: Optional[str] = Header(None),
):
    _require_doctor(env_id, x_session_token)
    with get_con() as con:
        row = con.execute(
            "SELECT gradcam_data FROM submissions WHERE id=? AND environment_id=?",
            (sub_id, env_id),
        ).fetchone()
    if not row or not row["gradcam_data"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Grad-CAM not available.")
    # Return the base64 data URI as JSON
    return {"gradcam_data": row["gradcam_data"]}


# ─── Doctor: review (notes/override/status) ───────────────────────────────────

@router.post("/{env_id}/submission/{sub_id}/review",
             summary="Doctor: update notes, status, and optional override")
async def review_submission(
    env_id: str,
    sub_id: str,
    doctor_notes: str = Form(default=""),
    new_status: str = Form(default="Reviewed"),
    override_label: str = Form(default=""),
    override_reason: str = Form(default=""),
    x_session_token: Optional[str] = Header(None),
):
    _require_doctor(env_id, x_session_token)

    VALID_STATUSES = {"Pending", "Reviewed", "Follow-up needed"}
    if new_status not in VALID_STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Status must be one of: {', '.join(VALID_STATUSES)}")

    if override_label and not override_reason.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Override reason is required when setting an override label.")

    VALID_OVERRIDES = {"Urgent review", "Elevated review", "Routine review",
                       "Unable to assess", ""}
    if override_label not in VALID_OVERRIDES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid override label.")

    with get_con() as con:
        row = con.execute(
            "SELECT id FROM submissions WHERE id=? AND environment_id=?",
            (sub_id, env_id),
        ).fetchone()
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found.")

        con.execute(
            """UPDATE submissions SET
               doctor_notes=?, status=?, override_label=?, override_reason=?
               WHERE id=?""",
            (
                doctor_notes or None,
                new_status,
                override_label or None,
                override_reason.strip() or None,
                sub_id,
            ),
        )
    return {"ok": True, "status": new_status}


# ─── Doctor: release guidance note to patient ────────────────────────────────

@router.post("/{env_id}/submission/{sub_id}/release",
             summary="Doctor: release guidance note visible to patient")
async def release_guidance(
    env_id: str,
    sub_id: str,
    guidance: str = Form(...),
    x_session_token: Optional[str] = Header(None),
):
    _require_doctor(env_id, x_session_token)
    if len(guidance.strip()) < 5:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Guidance note is too short.")
    if len(guidance) > 1000:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Guidance note must be under 1000 characters.")

    with get_con() as con:
        con.execute(
            "UPDATE submissions SET released_guidance=? WHERE id=? AND environment_id=?",
            (guidance.strip(), sub_id, env_id),
        )
    return {"ok": True}


# ─── Doctor: close join code ──────────────────────────────────────────────────

@router.post("/{env_id}/close", summary="Doctor: close the join code")
async def close_environment(
    env_id: str,
    x_session_token: Optional[str] = Header(None),
):
    _require_doctor(env_id, x_session_token)
    with get_con() as con:
        con.execute("UPDATE environments SET closed=1 WHERE id=?", (env_id,))
    return {"ok": True, "closed": True}


# ─── Doctor: regenerate join code ─────────────────────────────────────────────

@router.post("/{env_id}/regenerate", summary="Doctor: regenerate join code")
async def regenerate_code(
    env_id: str,
    x_session_token: Optional[str] = Header(None),
):
    _require_doctor(env_id, x_session_token)
    new_code = generate_join_code()
    with get_con() as con:
        con.execute(
            "UPDATE environments SET join_code=?, closed=0 WHERE id=?",
            (new_code, env_id),
        )
    return {"ok": True, "join_code": new_code}


# ─── Doctor: delete entire environment ───────────────────────────────────────

@router.delete("/{env_id}", summary="Doctor: delete environment and all data immediately")
async def delete_environment(
    env_id: str,
    x_session_token: Optional[str] = Header(None),
):
    _require_doctor(env_id, x_session_token)
    delete_environment_now(env_id)
    return {"ok": True, "message": "Environment and all data have been permanently deleted."}


# ─── Public: join by code (lookup env_id from join code) ──────────────────────

@router.get("/by-code/{join_code}", summary="Public: look up environment by join code")
async def env_by_code(join_code: str):
    with get_con() as con:
        row = con.execute(
            "SELECT id, expires_at, closed FROM environments WHERE join_code=?",
            (join_code.upper(),),
        ).fetchone()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid join code.")
    if is_expired(row["expires_at"]):
        raise HTTPException(status.HTTP_410_GONE, "This code has expired.")
    if row["closed"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This environment is closed.")
    return {"environment_id": row["id"], "expires_at": row["expires_at"]}
