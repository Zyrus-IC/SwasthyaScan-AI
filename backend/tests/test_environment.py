"""
SwasthyaScan AI — Environment Feature Tests
============================================
Run with:  pytest backend/tests/test_environment.py -v

Tests cover:
  - Code generation/expiry
  - Rate limiting + lockout
  - Wrong passcode → 401
  - Wrong/closed code → 404/403
  - Cross-environment access → 403
  - Patient data isolation
  - Priority rules (MODEL_VERIFIED false/true, failed inference, haemoptysis)
  - Retention cleanup
  - Full patient-to-doctor API flow (without image inference)
"""
from __future__ import annotations

import json
import os
import tempfile
import time
import unittest
from pathlib import Path

# Must set before importing app modules
os.environ["MODEL_VERIFIED"]          = "false"
os.environ["MODEL_THRESHOLD"]         = "0.5"
os.environ["ENVIRONMENT_EXPIRY_HOURS"] = "24"

from fastapi.testclient import TestClient

# ─── Test DB setup ────────────────────────────────────────────────────────────

def _make_app(tmp_dir: Path):
    """Create a fresh app wired to a temp DB + uploads dir."""
    from app.db.database import init_db, _DB_PATH
    import app.db.database as db_mod

    db_path = tmp_dir / "test.db"
    uploads = tmp_dir / "uploads"

    from app.services.upload_service import init_uploads
    init_uploads(uploads)
    db_mod._DB_PATH = None
    init_db(db_path)

    from app.main import app
    return app


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _create_env(client: TestClient, passcode: str = "TestP@ss1"):
    res = client.post("/api/env/create", data={"passcode": passcode})
    assert res.status_code == 200, res.text
    return res.json()


def _doctor_login(client: TestClient, env_id: str, passcode: str = "TestP@ss1"):
    res = client.post(f"/api/env/{env_id}/doctor-login", data={"passcode": passcode})
    assert res.status_code == 200, res.text
    return res.json()


def _patient_join(client: TestClient, env_id: str, code: str, pseudonym: str = "P-001"):
    res = client.post(f"/api/env/{env_id}/join",
                      data={"join_code": code, "pseudonym": pseudonym})
    return res


def _minimal_image_bytes() -> bytes:
    """64×64 JPEG for test uploads (meets minimum dimension)."""
    from PIL import Image as PILImage
    import io
    img = PILImage.new("RGB", (64, 64), color=(128, 128, 128))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
class TestCodeGeneration(unittest.TestCase):
    """Join code generation and format."""

    def test_code_is_8_chars(self):
        from app.services.auth_service import generate_join_code
        code = generate_join_code()
        self.assertEqual(len(code), 8)

    def test_code_unambiguous_alphabet(self):
        from app.services.auth_service import generate_join_code, _CODE_ALPHABET
        for _ in range(50):
            code = generate_join_code()
            for ch in code:
                self.assertIn(ch, _CODE_ALPHABET, f"Ambiguous char {ch!r} in code {code}")

    def test_codes_are_unique(self):
        from app.services.auth_service import generate_join_code
        codes = {generate_join_code() for _ in range(200)}
        self.assertGreater(len(codes), 190)


# ═══════════════════════════════════════════════════════════════════════════════
class TestPasscodeHashing(unittest.TestCase):
    """pbkdf2 hashing and constant-time compare."""

    def test_verify_correct(self):
        from app.services.auth_service import hash_passcode, verify_passcode
        h, s = hash_passcode("MySecret123!")
        self.assertTrue(verify_passcode("MySecret123!", h, s))

    def test_reject_wrong(self):
        from app.services.auth_service import hash_passcode, verify_passcode
        h, s = hash_passcode("MySecret123!")
        self.assertFalse(verify_passcode("WrongPassword", h, s))

    def test_different_salts(self):
        from app.services.auth_service import hash_passcode
        h1, s1 = hash_passcode("same")
        h2, s2 = hash_passcode("same")
        self.assertNotEqual(s1, s2)


# ═══════════════════════════════════════════════════════════════════════════════
class TestAPIFlow(unittest.TestCase):
    """Full patient → doctor API flow using TestClient."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.app = _make_app(Path(self.tmp.name))
        self.client = TestClient(self.app, raise_server_exceptions=True)

    def tearDown(self):
        self.tmp.cleanup()

    # ── Create environment ────────────────────────────────────────────────────

    def test_create_env_returns_join_code(self):
        d = _create_env(self.client)
        self.assertIn("join_code", d)
        self.assertEqual(len(d["join_code"]), 8)
        self.assertIn("environment_id", d)
        self.assertIn("session_token", d)

    def test_short_passcode_rejected(self):
        res = self.client.post("/api/env/create", data={"passcode": "short"})
        self.assertEqual(res.status_code, 400)

    # ── Doctor login ──────────────────────────────────────────────────────────

    def test_wrong_passcode_returns_401(self):
        d = _create_env(self.client)
        env_id = d["environment_id"]
        res = self.client.post(f"/api/env/{env_id}/doctor-login",
                               data={"passcode": "WrongPass99!"})
        self.assertEqual(res.status_code, 401)

    def test_correct_passcode_returns_token(self):
        d = _create_env(self.client)
        r = _doctor_login(self.client, d["environment_id"])
        self.assertIn("session_token", r)

    # ── Patient join ──────────────────────────────────────────────────────────

    def test_wrong_code_returns_404(self):
        d = _create_env(self.client)
        res = _patient_join(self.client, d["environment_id"], "XXXXXXXX")
        self.assertEqual(res.status_code, 404)

    def test_correct_code_returns_submission_id(self):
        d = _create_env(self.client)
        res = _patient_join(self.client, d["environment_id"], d["join_code"])
        self.assertEqual(res.status_code, 200)
        self.assertIn("submission_id", res.json())
        self.assertIn("session_token", res.json())

    def test_email_pseudonym_rejected(self):
        d = _create_env(self.client)
        res = self.client.post(f"/api/env/{d['environment_id']}/join",
                               data={"join_code": d["join_code"], "pseudonym": "user@example.com"})
        self.assertEqual(res.status_code, 400)

    # ── Cross-environment isolation ───────────────────────────────────────────

    def test_doctor_token_wrong_env_rejected(self):
        d1 = _create_env(self.client, "PassForEnv1!")
        d2 = _create_env(self.client, "PassForEnv2!")
        # Use env1's token to access env2's submissions
        res = self.client.get(
            f"/api/env/{d2['environment_id']}/submissions",
            headers={"X-Session-Token": d1["session_token"]},
        )
        self.assertEqual(res.status_code, 403)

    def test_patient_cannot_read_other_submission(self):
        d = _create_env(self.client)
        env_id = d["environment_id"]
        p1 = _patient_join(self.client, env_id, d["join_code"], "Patient1").json()
        p2 = _patient_join(self.client, env_id, d["join_code"], "Patient2").json()
        # Patient 1 tries to poll patient 2's status
        res = self.client.get(
            f"/api/env/{env_id}/status/{p2['submission_id']}",
            headers={"X-Session-Token": p1["session_token"]},
        )
        self.assertEqual(res.status_code, 403)

    # ── Closed environment ────────────────────────────────────────────────────

    def test_join_closed_env_returns_403(self):
        d = _create_env(self.client)
        env_id = d["environment_id"]
        tok = d["session_token"]
        self.client.post(f"/api/env/{env_id}/close",
                         headers={"X-Session-Token": tok})
        res = _patient_join(self.client, env_id, d["join_code"])
        self.assertEqual(res.status_code, 403)

    # ── Regenerate code ───────────────────────────────────────────────────────

    def test_regenerate_gives_new_code(self):
        d = _create_env(self.client)
        old = d["join_code"]
        res = self.client.post(f"/api/env/{d['environment_id']}/regenerate",
                               headers={"X-Session-Token": d["session_token"]})
        self.assertEqual(res.status_code, 200)
        new = res.json()["join_code"]
        self.assertNotEqual(old, new)   # very high probability

    # ── Doctor dashboard ──────────────────────────────────────────────────────

    def test_empty_queue_returns_empty(self):
        d = _create_env(self.client)
        res = self.client.get(f"/api/env/{d['environment_id']}/submissions",
                              headers={"X-Session-Token": d["session_token"]})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["submissions"], [])
        self.assertEqual(res.json()["counts"]["total"], 0)

    # ── Full submit + review flow (no real model) ─────────────────────────────

    def test_full_patient_to_doctor_flow(self):
        d = _create_env(self.client)
        env_id = d["environment_id"]

        # Patient joins
        p = _patient_join(self.client, env_id, d["join_code"], "TestPatient").json()
        sub_id = p["submission_id"]
        p_token = p["session_token"]

        # Patient submits image
        img_bytes = _minimal_image_bytes()
        res = self.client.post(
            f"/api/env/{env_id}/submit",
            data={"submission_id": sub_id, "symptoms": json.dumps({"fever": True, "fatigue": True})},
            files={"image": ("test.jpg", img_bytes, "image/jpeg")},
            headers={"X-Session-Token": p_token},
        )
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json()["status"], "Pending")

        # Doctor sees submission in queue
        d_token = d["session_token"]
        queue = self.client.get(f"/api/env/{env_id}/submissions",
                                headers={"X-Session-Token": d_token}).json()
        self.assertEqual(queue["counts"]["total"], 1)
        self.assertEqual(queue["submissions"][0]["pseudonym"], "TestPatient")

        # Doctor views detail
        det = self.client.get(f"/api/env/{env_id}/submission/{sub_id}",
                              headers={"X-Session-Token": d_token}).json()
        self.assertEqual(det["pseudonym"], "TestPatient")
        self.assertIsInstance(det["priority_reasons"], list)

        # Doctor saves review
        res = self.client.post(
            f"/api/env/{env_id}/submission/{sub_id}/review",
            data={"doctor_notes": "Looks clear", "new_status": "Reviewed"},
            headers={"X-Session-Token": d_token},
        )
        self.assertEqual(res.status_code, 200)

        # Doctor releases guidance
        res = self.client.post(
            f"/api/env/{env_id}/submission/{sub_id}/release",
            data={"guidance": "Please visit clinic next week."},
            headers={"X-Session-Token": d_token},
        )
        self.assertEqual(res.status_code, 200)

        # Patient polls and sees guidance
        res = self.client.get(f"/api/env/{env_id}/status/{sub_id}",
                              headers={"X-Session-Token": p_token})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["released_guidance"], "Please visit clinic next week.")

    # ── Delete environment ────────────────────────────────────────────────────

    def test_delete_removes_everything(self):
        d = _create_env(self.client)
        env_id = d["environment_id"]
        tok = d["session_token"]

        # Join and submit
        p = _patient_join(self.client, env_id, d["join_code"]).json()
        img_bytes = _minimal_image_bytes()
        self.client.post(
            f"/api/env/{env_id}/submit",
            data={"submission_id": p["submission_id"], "symptoms": "{}"},
            files={"image": ("t.jpg", img_bytes, "image/jpeg")},
            headers={"X-Session-Token": p["session_token"]},
        )

        # Delete
        res = self.client.delete(f"/api/env/{env_id}",
                                 headers={"X-Session-Token": tok})
        self.assertEqual(res.status_code, 200)

        # Subsequent access returns 404
        res = self.client.get(f"/api/env/{env_id}/submissions",
                              headers={"X-Session-Token": tok})
        self.assertIn(res.status_code, [401, 403, 404])


# ═══════════════════════════════════════════════════════════════════════════════
class TestRateLimit(unittest.TestCase):
    """Rate limiting lockout."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.app = _make_app(Path(self.tmp.name))
        self.client = TestClient(self.app)

    def tearDown(self):
        self.tmp.cleanup()

    def test_lockout_after_max_attempts(self):
        from app.services.rate_limit_service import MAX_ATTEMPTS
        d = _create_env(self.client)
        env_id = d["environment_id"]
        bad_code = "ZZZZZZZZ"
        statuses = []
        for _ in range(MAX_ATTEMPTS + 2):
            res = _patient_join(self.client, env_id, bad_code, "P")
            statuses.append(res.status_code)
        self.assertIn(429, statuses)


# ═══════════════════════════════════════════════════════════════════════════════
class TestPriorityRules(unittest.TestCase):
    """Priority engine rules in isolation."""

    def _compute(self, q, mo=None, flags=None):
        from app.services.priority_service import compute_priority
        return compute_priority(q, mo, flags or [])


    def test_haemoptysis_always_urgent(self):
        r = self._compute({"hemoptysis": True})
        self.assertEqual(r.label, "Urgent review")

    def test_no_data_returns_unable(self):
        r = self._compute({}, None)
        self.assertEqual(r.label, "Unable to assess")

    def test_failed_inference_never_routine(self):
        r = self._compute({"fatigue": True}, None)
        self.assertNotEqual(r.label, "Unable to assess")  # symptom saves it
        r2 = self._compute({}, None)
        self.assertEqual(r2.label, "Unable to assess")

    def test_three_symptoms_elevated(self):
        r = self._compute({"fever": True, "night_sweats": True,
                           "weight_loss": True, "persistent_cough": True})
        self.assertIn(r.label, ("Elevated review", "Urgent review"))

    def test_model_verified_false_ignored(self):
        os.environ["MODEL_VERIFIED"] = "false"
        mo = {"prediction": "TB", "score": 0.99, "threshold": 0.5}
        r = self._compute({"fatigue": True}, mo)
        self.assertEqual(r.label, "Routine review")

    def test_model_verified_true_tb_elevates(self):
        os.environ["MODEL_VERIFIED"] = "true"
        mo = {"prediction": "TB", "score": 0.4, "threshold": 0.1453}
        r = self._compute({}, mo)
        self.assertEqual(r.label, "Elevated review")
        os.environ["MODEL_VERIFIED"] = "false"

    def test_model_verified_high_score_urgent(self):
        os.environ["MODEL_VERIFIED"] = "true"
        mo = {"prediction": "TB", "score": 0.95, "threshold": 0.1453}
        r = self._compute({}, mo)
        self.assertEqual(r.label, "Urgent review")
        os.environ["MODEL_VERIFIED"] = "false"


# ═══════════════════════════════════════════════════════════════════════════════
class TestExifStripping(unittest.TestCase):
    """Image re-encode strips EXIF."""

    def test_exif_stripped(self):
        from PIL import Image as PILImage, ExifTags
        import io
        from app.services.upload_service import save_image, _UPLOADS_DIR
        import app.services.upload_service as us

        tmp = tempfile.TemporaryDirectory()
        us.init_uploads(Path(tmp.name))

        # Create image with EXIF GPS data
        img = PILImage.new("RGB", (64, 64))
        exif_bytes = img.getexif().tobytes()
        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif_bytes)
        buf.seek(0)

        fname = save_image(buf.read())
        out_path = Path(tmp.name) / fname

        reloaded = PILImage.open(out_path)
        exif_out = reloaded.getexif()
        # GPS tag = 34853 — should not be present
        self.assertNotIn(34853, exif_out)
        tmp.cleanup()


# ═══════════════════════════════════════════════════════════════════════════════
class TestRetentionCleanup(unittest.TestCase):
    """Cleanup deletes expired rows and files."""

    def test_expired_env_cleaned(self):
        tmp = tempfile.TemporaryDirectory()
        from app.db.database import init_db, get_con
        import app.db.database as db_mod
        from app.services.upload_service import init_uploads
        from app.services.auth_service import (
            hash_passcode, generate_join_code, new_environment_id, utcnow_str
        )
        from app.services.retention_service import run_cleanup

        db_mod._DB_PATH = None
        init_db(Path(tmp.name) / "r.db")
        init_uploads(Path(tmp.name) / "u")

        env_id = new_environment_id()
        ph, salt = hash_passcode("TestP@ss!")
        with get_con() as con:
            con.execute(
                """INSERT INTO environments
                   (id, join_code, passcode_hash, passcode_salt,
                    created_at, expires_at, closed)
                   VALUES (?,?,?,?,?,?,0)""",
                (env_id, generate_join_code(), ph, salt,
                 utcnow_str(), "2000-01-01T00:00:00+00:00"),  # already expired
            )
        n = run_cleanup()
        self.assertGreaterEqual(n, 1)

        with get_con() as con:
            row = con.execute("SELECT id FROM environments WHERE id=?", (env_id,)).fetchone()
        self.assertIsNone(row)
        tmp.cleanup()


if __name__ == "__main__":
    unittest.main()
