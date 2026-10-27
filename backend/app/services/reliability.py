"""
SwasthyaScan AI — Reliability Engine (Stage 8)
==============================================
Implements the full reliability-aware workflow.

This module evaluates:
  1. Image validity
  2. Model availability and inference result
  3. Input completeness (symptom information)
  4. Conflicting evidence (low model score + concerning symptoms)
  5. High-confidence positive signals

All thresholds are EXPERIMENTAL PROTOTYPE RULES — not clinically validated.
They are documented and configurable.

Result states:
  - completed           : Model ran successfully, no conflicting signals
  - review_recommended  : Model ran, but conflicting evidence or critical symptoms
  - limited             : Missing information or uncertain result
  - unavailable         : Model not configured or inference failed

RULES — explicitly NOT clinically validated:
  - REVIEW if score >= REVIEW_THRESHOLD and no critical symptoms
  - REVIEW_RECOMMENDED if hemoptysis reported (always, regardless of score)
  - REVIEW_RECOMMENDED if low score but >= MIN_CONCERNING_SYMPTOMS (conflict)
  - LIMITED if image valid but no symptom information at all
"""

from __future__ import annotations

import logging
from typing import Optional

from app.schemas.screening import (
    AnalysisStatus,
    ImageValidationResult,
    ModelOutput,
    ReliabilityFlag,
    ScreeningResponse,
    SymptomData,
)
from app.services import model_service
from app.services.gradcam_service import generate_gradcam

logger = logging.getLogger(__name__)

# ── Experimental thresholds (labelled as prototype rules) ─────────────────
# These are NOT clinically validated. Treat as initial engineering choices.
REVIEW_THRESHOLD     = 0.50   # Score >= this → TB prediction by model
CONFLICT_THRESHOLD   = 0.40   # Score below this but symptoms present → conflict
MIN_CONCERNING_SYMPTOMS = 2   # Need this many symptoms to trigger conflict flag


def _count_symptoms(s: SymptomData) -> int:
    """Count how many boolean symptom flags are True."""
    return sum([
        s.persistent_cough,
        s.fever,
        s.night_sweats,
        s.weight_loss,
        s.fatigue,
        s.hemoptysis,
    ])


def run_reliability_engine(
    *,
    image_validation: ImageValidationResult,
    symptoms: SymptomData,
    model_configured: bool,
    image_bytes: Optional[bytes] = None,
) -> ScreeningResponse:
    """
    Entry point for the reliability engine.

    Parameters
    ----------
    image_validation:  Result of image validation checks.
    symptoms:          Screening questionnaire responses.
    model_configured:  True when a model weights path is configured.
    image_bytes:       Raw image bytes for inference (None if not available).

    Returns
    -------
    A fully populated ScreeningResponse.
    """

    flags: list[ReliabilityFlag] = []
    review_reasons: list[str] = []
    limitations: list[str] = []

    # ── 1. Image validity flag ────────────────────────────────────────────
    flags.append(ReliabilityFlag(
        flag="Image validity",
        ok=image_validation.valid,
        note=image_validation.rejection_reason if not image_validation.valid else None,
    ))

    if not image_validation.valid:
        logger.info("Reliability engine: invalid image — returning unavailable.")
        return ScreeningResponse(
            status=AnalysisStatus.unavailable,
            message=(
                "The uploaded image failed validation and cannot be analysed. "
                f"{image_validation.rejection_reason or ''}"
            ).strip(),
            image_validation=image_validation,
            reliability_flags=flags,
            review_reasons=review_reasons,
            limitations=["Image could not be validated — no analysis was performed."],
        )

    # ── 2. Model availability flag ─────────────────────────────────────────
    model_actually_loaded = model_service.is_model_loaded()
    flags.append(ReliabilityFlag(
        flag="AI model availability",
        ok=model_actually_loaded,
        note=(
            None if model_actually_loaded
            else (
                "No verified model weights are configured. "
                "This is the expected state during prototype development."
                if not model_configured
                else "Model weights path is set but model failed to load."
            )
        ),
    ))

    if not model_actually_loaded:
        limitations.append(
            "No verified AI model has been integrated. "
            "Model inference is unavailable — this is the expected honest behaviour "
            "at the current development stage."
        )
        symptomatic = _count_symptoms(symptoms) > 0
        logger.info(
            "Reliability engine: image_valid=%s model_loaded=%s symptomatic=%s",
            image_validation.valid, model_actually_loaded, symptomatic,
        )
        return ScreeningResponse(
            status=AnalysisStatus.unavailable,
            message=(
                "The AI model is not currently configured. No TB prediction was generated. "
                "This is the expected honest behaviour — it does not mean a negative result. "
                "Professional medical assessment is required regardless of any tool output."
            ),
            image_validation=image_validation,
            model_output=None,
            reliability_flags=flags,
            review_reasons=review_reasons,
            limitations=limitations,
        )

    # ── 3. Run inference ───────────────────────────────────────────────────
    inference_result = None
    if image_bytes is not None:
        try:
            inference_result = model_service.run_inference(image_bytes)
        except Exception as exc:
            logger.error("Inference error in reliability engine: %s", exc, exc_info=True)
            inference_result = None

    if inference_result is None:
        # Inference failed — honest error state, NOT a negative result
        flags.append(ReliabilityFlag(
            flag="Model inference",
            ok=False,
            note="Inference could not be completed — the result is unavailable, not negative.",
        ))
        limitations.append(
            "Model inference failed. The result is 'Unable to Assess', not a negative TB result."
        )
        return ScreeningResponse(
            status=AnalysisStatus.unavailable,
            message=(
                "The model is loaded but inference could not be completed. "
                "This is an 'Unable to Assess' result — not a negative result. "
                "Professional assessment is required."
            ),
            image_validation=image_validation,
            model_output=None,
            reliability_flags=flags,
            review_reasons=review_reasons,
            limitations=limitations,
        )

    # Inference succeeded
    score      = inference_result["score"]
    prediction = inference_result["prediction"]
    flags.append(ReliabilityFlag(
        flag="Model inference",
        ok=True,
        note=f"Score={score:.3f}  Prediction={prediction}",
    ))

    model_output = ModelOutput(
        prediction=prediction,
        score=score,
        label_meaning=inference_result["label_meaning"],
    )

    # ── 4. Symptom completeness flag ───────────────────────────────────────
    n_symptoms = _count_symptoms(symptoms)
    flags.append(ReliabilityFlag(
        flag="Symptom information",
        ok=(n_symptoms > 0),
        note=(
            "No symptoms reported — result is based on image alone."
            if n_symptoms == 0
            else f"{n_symptoms} symptom(s) reported."
        ),
    ))

    if n_symptoms == 0:
        limitations.append(
            "No symptom information was provided. The result is based on the image alone "
            "and may not reflect the full clinical picture."
        )

    # ── 5. Critical symptom flag — hemoptysis ─────────────────────────────
    if symptoms.hemoptysis:
        flags.append(ReliabilityFlag(
            flag="Critical symptom — haemoptysis",
            ok=False,
            note=(
                "[PROTOTYPE RULE] Blood in sputum is flagged as requiring urgent professional "
                "assessment regardless of model output. Seek medical care promptly."
            ),
        ))
        review_reasons.append(
            "[Prototype rule — not clinically validated] Haemoptysis (blood in sputum) "
            "was reported. This requires prompt professional assessment "
            "independent of any AI model output."
        )

    # ── 6. Conflicting evidence flag ───────────────────────────────────────
    # Prototype rule: low model score + multiple concerning symptoms = conflict
    score_tb   = (score >= REVIEW_THRESHOLD)
    score_low  = (score < CONFLICT_THRESHOLD)
    many_symptoms = (n_symptoms >= MIN_CONCERNING_SYMPTOMS)

    if score_low and many_symptoms:
        flags.append(ReliabilityFlag(
            flag="Conflicting evidence",
            ok=False,
            note=(
                f"[PROTOTYPE RULE] Model score is low ({score:.3f}) but "
                f"{n_symptoms} screening symptoms are present. "
                "A low score does not rule out TB when symptoms are concerning."
            ),
        ))
        review_reasons.append(
            f"[Prototype rule — not clinically validated] The model returned a score of {score:.3f} "
            f"(below {CONFLICT_THRESHOLD}) but {n_symptoms} TB-associated symptom(s) are reported. "
            "A low AI score does not rule out tuberculosis — professional clinical assessment is recommended."
        )

    # ── 7. Determine final status ──────────────────────────────────────────
    if review_reasons:
        status  = AnalysisStatus.review_recommended
        message = (
            f"The model returned a score of {score:.3f} (prediction: {prediction}). "
            "Review is recommended because conflicting or concerning information was identified. "
            "A model score alone is not sufficient to reassure or dismiss — professional assessment is required."
        )
    elif score_tb:
        status  = AnalysisStatus.review_recommended
        message = (
            f"The model returned a score of {score:.3f} and predicted '{prediction}'. "
            "This result requires professional assessment. "
            "A positive AI screening result does not confirm tuberculosis."
        )
        review_reasons.append(
            f"[Model output] Score {score:.3f} ≥ {REVIEW_THRESHOLD} — model classified as TB-consistent. "
            "Professional clinical assessment required."
        )
    elif n_symptoms == 0:
        status  = AnalysisStatus.limited
        message = (
            f"The model returned a score of {score:.3f} (prediction: {prediction}). "
            "No symptom information was provided, so the result is classified as 'Analysis Limited'. "
            "This result does not rule out tuberculosis."
        )
    else:
        status  = AnalysisStatus.completed
        message = (
            f"The model returned a score of {score:.3f} (prediction: {prediction}). "
            "No conflicting reliability signals were detected. "
            "A low score does not rule out tuberculosis — professional assessment remains necessary."
        )

    limitations.append(
        "The model score is not a calibrated probability and has not been clinically validated. "
        "Results are for research and educational purposes only."
    )

    # ── Grad-CAM explainability (optional, best-effort) ────────────────────────
    # Only attempt if image bytes are available and inference succeeded.
    # Never fabricate a heatmap; fail gracefully if generation is unsupported.
    gradcam_heatmap: Optional[str] = None
    if image_bytes is not None and model_service._model_instance is not None:
        try:
            gradcam_heatmap = generate_gradcam(
                image_bytes=image_bytes,
                model_instance=model_service._model_instance,
                device=model_service._device,
                config=model_service._config_cache,
            )
            if gradcam_heatmap:
                logger.info("Grad-CAM heatmap generated successfully.")
                limitations.append(
                    "The Grad-CAM attention map shows regions that influenced the model's output. "
                    "It is a model explanation tool — not a clinical imaging finding."
                )
            else:
                logger.info("Grad-CAM returned None — response will not include a heatmap.")
        except Exception as exc:
            logger.warning("Grad-CAM error (non-fatal): %s", exc)

    logger.info(
        "Reliability engine complete: status=%s score=%.4f prediction=%s n_symptoms=%d gradcam=%s",
        status, score, prediction, n_symptoms, gradcam_heatmap is not None,
    )

    return ScreeningResponse(
        status=status,
        message=message,
        image_validation=image_validation,
        model_output=model_output,
        reliability_flags=flags,
        review_reasons=review_reasons,
        limitations=limitations,
        gradcam_heatmap=gradcam_heatmap,
    )
