"""
SwasthyaScan AI ”” Screening Analysis Route
=========================================
POST /api/screening/analyze

Request (multipart/form-data)
-------------------------------
image    : UploadFile   ”” JPEG or PNG chest X-ray
symptoms : str (JSON)   ”” serialised SymptomData object

Response
--------
200: ScreeningResponse  ”” always structured; status indicates result state
422: Validation error   ”” malformed request
400: Bad request        ”” invalid file type reported via ScreeningResponse

Design rules (non-negotiable)
------------------------------
- Never fabricate a TB prediction, confidence score, or heatmap.
- If the model is not configured, return status=unavailable ”” NOT a
  negative result.
- Validate all inputs before processing.
- Clean up any temporary state after the request completes.
- Never expose internal stack traces to the client.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.core.config import settings
from app.schemas.screening import ScreeningResponse, SymptomData
from app.services.image_service import validate_image
from app.services.reliability import run_reliability_engine

router = APIRouter(prefix="/api", tags=["screening"])
logger = logging.getLogger(__name__)

# Allowed upload MIME types (also enforced by Pillow; this is a first gate).
ALLOWED_CONTENT_TYPES = frozenset({
    "image/jpeg",
    "image/jpg",
    "image/png",
})


@router.post(
    "/screening/analyze",
    response_model=ScreeningResponse,
    summary="Submit X-ray and symptoms for reliability-aware analysis",
    description=(
        "Accepts a chest X-ray image and screening questionnaire responses. "
        "Returns a structured reliability-aware result. "
        "When no verified model is configured, returns an honest 'Unable to Assess' state ”” "
        "this is NOT equivalent to a negative tuberculosis result."
    ),
    status_code=status.HTTP_200_OK,
)
async def analyze(
    image: UploadFile = File(
        ...,
        description="Chest X-ray image ”” JPEG or PNG, max 10 MB.",
    ),
    symptoms: str = Form(
        default="{}",
        description="JSON-encoded SymptomData object.",
    ),
) -> ScreeningResponse:
    """
    Main screening endpoint.

    Processing pipeline (Stage 5)
    ------------------------------
    1. Validate MIME type (first-gate check).
    2. Read file bytes.
    3. Validate file size.
    4. Validate image via Pillow (format + decodability + dimensions).
    5. Parse symptom JSON.
    6. Run reliability engine (returns unavailable at Stage 5).
    7. Return structured response.
    """

    # â”€â”€ 1. Content-type pre-check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # Pillow will also verify the actual format, but rejecting obvious mismatches
    # early avoids reading the full file for clearly wrong content types.
    if image.content_type and image.content_type not in ALLOWED_CONTENT_TYPES:
        logger.warning(
            "Rejected upload: unsupported content_type=%s filename=%s",
            image.content_type,
            image.filename,
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Unsupported content type '{image.content_type}'. "
                "Please upload a JPEG or PNG image."
            ),
        )

    # â”€â”€ 2. Read file bytes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try:
        data = await image.read()
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to read uploaded file: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read the uploaded file. Please try again.",
        ) from exc
    finally:
        await image.close()

    filename = image.filename or "upload"

    # â”€â”€ 3”“4. Image validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    image_validation = validate_image(
        data=data,
        filename=filename,
        max_size_bytes=settings.max_upload_size_bytes,
    )

    # â”€â”€ 5. Parse symptom data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try:
        raw = json.loads(symptoms) if symptoms.strip() else {}
        # The frontend sends camelCase keys; map to snake_case where needed.
        symptom_data = _parse_symptoms(raw)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("Failed to parse symptoms JSON: %s", exc)
        # Symptoms are optional context; don't abort the whole request.
        symptom_data = SymptomData()

    # â”€â”€ 6. Reliability engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    response = run_reliability_engine(
        image_validation=image_validation,
        symptoms=symptom_data,
        model_configured=settings.model_configured,
        image_bytes=data if image_validation.valid else None,
    )

    # Attach the original filename for the frontend results display.
    response.image_name = filename

    logger.info(
        "Screening request complete: status=%s image_valid=%s model_configured=%s",
        response.status,
        image_validation.valid,
        settings.model_configured,
    )

    return response


# â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _parse_symptoms(raw: dict) -> SymptomData:
    """
    Map frontend camelCase keys to backend snake_case field names.

    The frontend sends:
      persistentCough, fever, nightSweats, weightLoss, fatigue,
      hemoptysis, coughDuration, additionalNotes

    Pydantic model expects snake_case.
    """
    mapping = {
        "persistentCough": "persistent_cough",
        "nightSweats":     "night_sweats",
        "weightLoss":      "weight_loss",
        "coughDuration":   "cough_duration",
        "additionalNotes": "additional_notes",
    }
    normalised: dict = {}
    for k, v in raw.items():
        normalised[mapping.get(k, k)] = v

    return SymptomData(**normalised)

