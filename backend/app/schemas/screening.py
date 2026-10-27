"""
SwasthyaScan AI ”” Pydantic Schemas: Screening
============================================
Request and response models for POST /api/screening/analyze.

Design notes
------------
- AnalysisStatus is an application workflow state, NOT a medical diagnosis.
- model_output is only populated when a verified model has actually run.
- The reliability engine always returns flags; the frontend decides how to
  display them.
- Never fabricate prediction values, confidence scores, or heatmaps.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# â”€â”€ Enumerations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class AnalysisStatus(str, Enum):
    """
    Four honest application workflow states.

    completed          ”” A verified model ran and returned a valid output.
    limited            ”” Analysis ran but a documented limitation reduces
                         confidence.
    review_recommended ”” A reliability rule triggered a review recommendation.
    unavailable        ”” Model inference is unavailable or a required step
                         failed.  NOT equivalent to a negative result.
    """

    completed = "completed"
    limited = "limited"
    review_recommended = "review_recommended"
    unavailable = "unavailable"


# â”€â”€ Sub-models â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class SymptomData(BaseModel):
    """Screening questionnaire responses from the frontend."""

    persistent_cough: bool = False
    fever: bool = False
    night_sweats: bool = False
    weight_loss: bool = False
    fatigue: bool = False
    hemoptysis: bool = False
    cough_duration: str = ""
    additional_notes: str = ""


class ImageValidationResult(BaseModel):
    """Result of the image validation / quality checks."""

    valid: bool
    format_ok: bool
    size_ok: bool
    decodable: bool
    width: int | None = None
    height: int | None = None
    aspect_ratio: float | None = None
    file_size_bytes: int | None = None
    rejection_reason: str | None = None


class ModelOutput(BaseModel):
    """
    Raw model inference output.

    Only included in the response when a verified model has run successfully.
    score is NOT a calibrated probability ”” this is documented explicitly.
    """

    prediction: Literal["TB", "Normal"]
    score: float = Field(ge=0.0, le=1.0, description="Raw model score [0”“1].")
    label_meaning: str = Field(
        description="Human-readable description of what this score means for this model."
    )
    calibration_note: str = (
        "This score is not a calibrated probability. A high score does not confirm TB; "
        "a low score does not rule it out. Professional assessment is required."
    )


class ReliabilityFlag(BaseModel):
    """A single reliability check result."""

    flag: str = Field(description="Name of the reliability check.")
    ok: bool = Field(description="True if the check passed.")
    note: str | None = Field(default=None, description="Explanation of a failed check.")


# â”€â”€ Main response model â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ScreeningResponse(BaseModel):
    """
    POST /api/screening/analyze â†’ 200 response.

    All fields that could reveal a medical prediction are only populated
    when a verified model has actually produced the output.
    """

    model_config = ConfigDict(protected_namespaces=())

    status: AnalysisStatus
    message: str
    image_validation: ImageValidationResult
    model_output: ModelOutput | None = Field(
        default=None,
        description="Populated only when status == 'completed' and a verified model ran.",
    )
    reliability_flags: list[ReliabilityFlag] = Field(default_factory=list)
    review_reasons: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    image_name: str | None = None
    gradcam_heatmap: str | None = Field(
        default=None,
        description=(
            "Base64-encoded PNG data URI of the Grad-CAM attention map. "
            "Only present when a verified model ran AND Grad-CAM succeeded. "
            "This is a model explanation — NOT a clinical finding or diagnostic image."
        ),
    )


# â”€â”€ Error responses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ErrorDetail(BaseModel):
    """Standard error response body."""

    detail: str
    code: str | None = None

