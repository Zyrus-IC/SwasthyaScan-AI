"""
SwasthyaScan AI — Tests: Reliability Engine
============================================
Unit tests for app/services/reliability.py.

Tests each rule in isolation using mock ImageValidationResult and SymptomData.
No real images or model weights needed.

Rules under test (all labelled as PROTOTYPE RULES — not clinically validated):
  1. Invalid image → unavailable
  2. Model not loaded → unavailable
  3. No symptoms → limited
  4. Hemoptysis present → review_recommended
  5. Low score + multiple symptoms → review_recommended (conflicting evidence)
  6. High score (TB-consistent) → review_recommended
  7. Valid image + symptoms + low score (no conflict) → completed

Run with:
    cd backend
    pytest tests/test_reliability.py -v
"""

from __future__ import annotations

import pytest
from unittest.mock import patch

from app.schemas.screening import (
    AnalysisStatus,
    ImageValidationResult,
    SymptomData,
)
from app.services.reliability import run_reliability_engine


# ── Helpers ────────────────────────────────────────────────────────────────────

def _valid_image() -> ImageValidationResult:
    return ImageValidationResult(
        valid=True, format_ok=True, decodable=True, size_ok=True,
        width=512, height=512, aspect_ratio=1.0,
        file_size_bytes=50000,
    )


def _invalid_image(reason: str = "Image could not be decoded.") -> ImageValidationResult:
    return ImageValidationResult(
        valid=False, format_ok=False, decodable=False, size_ok=True,
        width=None, height=None, aspect_ratio=None,
        file_size_bytes=100,
        rejection_reason=reason,
    )


def _no_symptoms() -> SymptomData:
    return SymptomData()


def _one_symptom() -> SymptomData:
    return SymptomData(persistent_cough=True)


def _many_symptoms() -> SymptomData:
    """2 or more symptoms — enough to trigger conflict if score is low."""
    return SymptomData(persistent_cough=True, fever=True)


def _hemoptysis_symptoms() -> SymptomData:
    return SymptomData(hemoptysis=True)


# Mock inference result helpers
def _mock_inference(score: float):
    prediction = "TB" if score >= 0.5 else "Normal"
    return {
        "prediction": prediction,
        "score": round(score, 6),
        "label_meaning": f"Test label meaning for score {score:.3f}",
    }


# ── Rule 1: Invalid image ───────────────────────────────────────────────────────

class TestInvalidImage:
    def test_invalid_image_returns_unavailable(self):
        result = run_reliability_engine(
            image_validation=_invalid_image(),
            symptoms=_no_symptoms(),
            model_configured=False,
            image_bytes=None,
        )
        assert result.status == AnalysisStatus.unavailable

    def test_invalid_image_has_no_model_output(self):
        result = run_reliability_engine(
            image_validation=_invalid_image(),
            symptoms=_no_symptoms(),
            model_configured=False,
            image_bytes=None,
        )
        assert result.model_output is None

    def test_invalid_image_message_explains_issue(self):
        result = run_reliability_engine(
            image_validation=_invalid_image("File was empty."),
            symptoms=_no_symptoms(),
            model_configured=False,
            image_bytes=None,
        )
        assert "File was empty" in result.message

    def test_invalid_image_has_image_validity_flag(self):
        result = run_reliability_engine(
            image_validation=_invalid_image(),
            symptoms=_no_symptoms(),
            model_configured=False,
            image_bytes=None,
        )
        flag = next((f for f in result.reliability_flags if "validity" in f.flag.lower()), None)
        assert flag is not None
        assert flag.ok is False


# ── Rule 2: Model not configured ───────────────────────────────────────────────

class TestModelNotConfigured:
    def test_no_model_returns_unavailable(self):
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_no_symptoms(),
            model_configured=False,
            image_bytes=None,
        )
        assert result.status == AnalysisStatus.unavailable

    def test_no_model_output_is_null(self):
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_no_symptoms(),
            model_configured=False,
            image_bytes=None,
        )
        assert result.model_output is None

    def test_no_model_limitations_not_empty(self):
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_no_symptoms(),
            model_configured=False,
            image_bytes=None,
        )
        assert len(result.limitations) > 0

    def test_no_model_message_mentions_unavailable(self):
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_no_symptoms(),
            model_configured=False,
            image_bytes=None,
        )
        assert result.message is not None
        assert len(result.message) > 0


# ── Rule 3: No symptom information → limited ──────────────────────────────────

class TestNoSymptoms:
    @patch("app.services.model_service.is_model_loaded", return_value=True)
    @patch("app.services.model_service.run_inference")
    def test_no_symptoms_gives_limited(self, mock_infer, mock_loaded):
        mock_infer.return_value = _mock_inference(0.2)
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_no_symptoms(),
            model_configured=True,
            image_bytes=b"fake",
        )
        assert result.status == AnalysisStatus.limited

    @patch("app.services.model_service.is_model_loaded", return_value=True)
    @patch("app.services.model_service.run_inference")
    def test_no_symptoms_limitation_documented(self, mock_infer, mock_loaded):
        mock_infer.return_value = _mock_inference(0.2)
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_no_symptoms(),
            model_configured=True,
            image_bytes=b"fake",
        )
        symptom_flag = next(
            (f for f in result.reliability_flags if "symptom" in f.flag.lower()), None
        )
        assert symptom_flag is not None
        assert symptom_flag.ok is False


# ── Rule 4: Hemoptysis → always review_recommended ────────────────────────────

class TestHemoptysis:
    @patch("app.services.model_service.is_model_loaded", return_value=True)
    @patch("app.services.model_service.run_inference")
    def test_hemoptysis_triggers_review(self, mock_infer, mock_loaded):
        mock_infer.return_value = _mock_inference(0.1)  # low score
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_hemoptysis_symptoms(),
            model_configured=True,
            image_bytes=b"fake",
        )
        assert result.status == AnalysisStatus.review_recommended

    @patch("app.services.model_service.is_model_loaded", return_value=True)
    @patch("app.services.model_service.run_inference")
    def test_hemoptysis_review_reason_documented(self, mock_infer, mock_loaded):
        mock_infer.return_value = _mock_inference(0.1)
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_hemoptysis_symptoms(),
            model_configured=True,
            image_bytes=b"fake",
        )
        assert any("haemoptysis" in r.lower() or "hemoptysis" in r.lower()
                   for r in result.review_reasons)


# ── Rule 5: Conflicting evidence ──────────────────────────────────────────────

class TestConflictingEvidence:
    @patch("app.services.model_service.is_model_loaded", return_value=True)
    @patch("app.services.model_service.run_inference")
    def test_low_score_plus_many_symptoms_triggers_review(self, mock_infer, mock_loaded):
        """Score < 0.40 + 2 symptoms = conflicting evidence → review_recommended."""
        mock_infer.return_value = _mock_inference(0.2)
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_many_symptoms(),
            model_configured=True,
            image_bytes=b"fake",
        )
        assert result.status == AnalysisStatus.review_recommended

    @patch("app.services.model_service.is_model_loaded", return_value=True)
    @patch("app.services.model_service.run_inference")
    def test_conflict_flag_in_reliability_flags(self, mock_infer, mock_loaded):
        mock_infer.return_value = _mock_inference(0.2)
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_many_symptoms(),
            model_configured=True,
            image_bytes=b"fake",
        )
        conflict_flag = next(
            (f for f in result.reliability_flags if "conflict" in f.flag.lower()), None
        )
        assert conflict_flag is not None
        assert conflict_flag.ok is False


# ── Rule 6: High model score → review_recommended ─────────────────────────────

class TestHighScore:
    @patch("app.services.model_service.is_model_loaded", return_value=True)
    @patch("app.services.model_service.run_inference")
    def test_tb_score_triggers_review(self, mock_infer, mock_loaded):
        """Score >= 0.50 → TB-consistent → review_recommended."""
        mock_infer.return_value = _mock_inference(0.75)
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_one_symptom(),
            model_configured=True,
            image_bytes=b"fake",
        )
        assert result.status == AnalysisStatus.review_recommended

    @patch("app.services.model_service.is_model_loaded", return_value=True)
    @patch("app.services.model_service.run_inference")
    def test_high_score_has_model_output(self, mock_infer, mock_loaded):
        mock_infer.return_value = _mock_inference(0.75)
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_one_symptom(),
            model_configured=True,
            image_bytes=b"fake",
        )
        assert result.model_output is not None
        assert result.model_output.prediction == "TB"

    @patch("app.services.model_service.is_model_loaded", return_value=True)
    @patch("app.services.model_service.run_inference")
    def test_high_score_review_reason_not_empty(self, mock_infer, mock_loaded):
        mock_infer.return_value = _mock_inference(0.75)
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_one_symptom(),
            model_configured=True,
            image_bytes=b"fake",
        )
        assert len(result.review_reasons) > 0


# ── Rule 7: Clean result → completed ─────────────────────────────────────────

class TestCompletedResult:
    @patch("app.services.model_service.is_model_loaded", return_value=True)
    @patch("app.services.model_service.run_inference")
    def test_low_score_with_symptoms_no_conflict_is_completed(self, mock_infer, mock_loaded):
        """Score < 0.40, only 1 symptom, no hemoptysis → completed."""
        mock_infer.return_value = _mock_inference(0.15)
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_one_symptom(),
            model_configured=True,
            image_bytes=b"fake",
        )
        assert result.status == AnalysisStatus.completed

    @patch("app.services.model_service.is_model_loaded", return_value=True)
    @patch("app.services.model_service.run_inference")
    def test_completed_has_model_output(self, mock_infer, mock_loaded):
        mock_infer.return_value = _mock_inference(0.15)
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_one_symptom(),
            model_configured=True,
            image_bytes=b"fake",
        )
        assert result.model_output is not None
        assert result.model_output.prediction == "Normal"

    @patch("app.services.model_service.is_model_loaded", return_value=True)
    @patch("app.services.model_service.run_inference")
    def test_completed_has_no_review_reasons(self, mock_infer, mock_loaded):
        mock_infer.return_value = _mock_inference(0.15)
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_one_symptom(),
            model_configured=True,
            image_bytes=b"fake",
        )
        assert len(result.review_reasons) == 0

    @patch("app.services.model_service.is_model_loaded", return_value=True)
    @patch("app.services.model_service.run_inference")
    def test_completed_always_has_limitations_documented(self, mock_infer, mock_loaded):
        """Even a clean result must document that the score is not calibrated."""
        mock_infer.return_value = _mock_inference(0.15)
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_one_symptom(),
            model_configured=True,
            image_bytes=b"fake",
        )
        assert len(result.limitations) > 0


# ── Response schema completeness ──────────────────────────────────────────────

class TestResponseSchema:
    def test_all_responses_have_status(self):
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_no_symptoms(),
            model_configured=False,
        )
        assert result.status is not None

    def test_all_responses_have_reliability_flags(self):
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_no_symptoms(),
            model_configured=False,
        )
        assert isinstance(result.reliability_flags, list)
        assert len(result.reliability_flags) > 0

    def test_all_responses_have_message(self):
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_no_symptoms(),
            model_configured=False,
        )
        assert isinstance(result.message, str)
        assert len(result.message) > 0

    def test_all_responses_have_image_validation(self):
        result = run_reliability_engine(
            image_validation=_valid_image(),
            symptoms=_no_symptoms(),
            model_configured=False,
        )
        assert result.image_validation is not None
