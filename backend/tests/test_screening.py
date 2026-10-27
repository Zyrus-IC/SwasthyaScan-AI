"""
SwasthyaScan AI ”” Tests: Screening Endpoint
==========================================
Integration tests for POST /api/screening/analyze.

Tests cover:
  - Valid image + symptoms â†’ honest "unavailable" response
  - Invalid file type â†’ 422 error
  - Empty file â†’ response with valid=False image validation
  - Missing symptoms â†’ default to empty SymptomData (no crash)
  - Response schema completeness

No real patient images are used.

Run with:
    cd backend
    pytest tests/test_screening.py -v
"""

from __future__ import annotations

import io
import json

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


# â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _make_jpeg_bytes(width: int = 256, height: int = 256) -> bytes:
    img = Image.new("RGB", (width, height), color=(100, 100, 100))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_png_bytes() -> bytes:
    img = Image.new("RGB", (128, 128), color=(80, 80, 80))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


SAMPLE_SYMPTOMS = json.dumps({
    "persistentCough": True,
    "fever": False,
    "nightSweats": False,
    "weightLoss": False,
    "fatigue": False,
    "hemoptysis": False,
    "coughDuration": "3 weeks",
    "additionalNotes": "",
})

EMPTY_SYMPTOMS = json.dumps({})


# â”€â”€ Valid submissions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestValidSubmission:
    """A valid JPEG + symptoms should always return 200 with a structured response."""

    def _post(self, image_bytes: bytes, content_type: str = "image/jpeg", symptoms: str = SAMPLE_SYMPTOMS):
        return client.post(
            "/api/screening/analyze",
            files={"image": ("chest.jpg", image_bytes, content_type)},
            data={"symptoms": symptoms},
        )

    def test_valid_jpeg_returns_200(self) -> None:
        response = self._post(_make_jpeg_bytes())
        assert response.status_code == 200, response.text

    def test_valid_png_returns_200(self) -> None:
        response = client.post(
            "/api/screening/analyze",
            files={"image": ("chest.png", _make_png_bytes(), "image/png")},
            data={"symptoms": EMPTY_SYMPTOMS},
        )
        assert response.status_code == 200

    def test_response_has_status_field(self) -> None:
        data = self._post(_make_jpeg_bytes()).json()
        assert "status" in data

    def test_response_status_is_unavailable(self) -> None:
        """
        With no model configured, status must be 'unavailable' ”” not a prediction.
        """
        data = self._post(_make_jpeg_bytes()).json()
        assert data["status"] == "unavailable"

    def test_model_output_is_null(self) -> None:
        """model_output must be null until a verified model is integrated."""
        data = self._post(_make_jpeg_bytes()).json()
        assert data["model_output"] is None

    def test_response_has_image_validation(self) -> None:
        data = self._post(_make_jpeg_bytes()).json()
        assert "image_validation" in data
        iv = data["image_validation"]
        assert "valid" in iv
        assert "format_ok" in iv
        assert "decodable" in iv

    def test_image_validation_valid_for_good_image(self) -> None:
        data = self._post(_make_jpeg_bytes()).json()
        assert data["image_validation"]["valid"] is True

    def test_response_has_reliability_flags(self) -> None:
        data = self._post(_make_jpeg_bytes()).json()
        assert "reliability_flags" in data
        assert isinstance(data["reliability_flags"], list)

    def test_response_has_message(self) -> None:
        data = self._post(_make_jpeg_bytes()).json()
        assert isinstance(data["message"], str)
        assert len(data["message"]) > 0

    def test_response_has_limitations(self) -> None:
        data = self._post(_make_jpeg_bytes()).json()
        assert "limitations" in data
        assert isinstance(data["limitations"], list)


# â”€â”€ Invalid file type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestInvalidFileType:
    def test_text_file_rejected_with_422(self) -> None:
        response = client.post(
            "/api/screening/analyze",
            files={"image": ("report.txt", b"plain text content", "text/plain")},
            data={"symptoms": EMPTY_SYMPTOMS},
        )
        assert response.status_code == 422

    def test_pdf_rejected_with_422(self) -> None:
        response = client.post(
            "/api/screening/analyze",
            files={"image": ("doc.pdf", b"%PDF-1.4 fake", "application/pdf")},
            data={"symptoms": EMPTY_SYMPTOMS},
        )
        assert response.status_code == 422


# â”€â”€ Empty / bad image â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestEmptyImage:
    def test_empty_file_returns_200_with_invalid_image(self) -> None:
        """
        An empty file should return 200 with a structured response indicating
        the image is invalid ”” NOT a 500 error.
        """
        response = client.post(
            "/api/screening/analyze",
            files={"image": ("empty.jpg", b"", "image/jpeg")},
            data={"symptoms": EMPTY_SYMPTOMS},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["image_validation"]["valid"] is False
        assert data["status"] == "unavailable"

    def test_corrupt_bytes_returns_structured_response(self) -> None:
        response = client.post(
            "/api/screening/analyze",
            files={"image": ("bad.jpg", b"\x00\x01\x02\x03\xff", "image/jpeg")},
            data={"symptoms": EMPTY_SYMPTOMS},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["image_validation"]["valid"] is False


# â”€â”€ Missing fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestMissingFields:
    def test_missing_image_returns_422(self) -> None:
        response = client.post(
            "/api/screening/analyze",
            data={"symptoms": EMPTY_SYMPTOMS},
        )
        assert response.status_code == 422

    def test_missing_symptoms_uses_defaults(self) -> None:
        """symptoms field is optional ”” missing it must not crash the endpoint."""
        response = client.post(
            "/api/screening/analyze",
            files={"image": ("chest.jpg", _make_jpeg_bytes(), "image/jpeg")},
            # No symptoms field at all.
        )
        assert response.status_code == 200

    def test_empty_symptoms_json_accepted(self) -> None:
        response = client.post(
            "/api/screening/analyze",
            files={"image": ("chest.jpg", _make_jpeg_bytes(), "image/jpeg")},
            data={"symptoms": "{}"},
        )
        assert response.status_code == 200

    def test_malformed_symptoms_json_handled_gracefully(self) -> None:
        """Malformed JSON in symptoms must not crash the endpoint."""
        response = client.post(
            "/api/screening/analyze",
            files={"image": ("chest.jpg", _make_jpeg_bytes(), "image/jpeg")},
            data={"symptoms": "not valid json {{{"},
        )
        assert response.status_code == 200

