"""
SwasthyaScan AI ”” Tests: Image Service
=====================================
Unit tests for the image validation service (app/services/image_service.py).

These tests use minimal synthetic image data ”” no real patient images.

Run with:
    cd backend
    pytest tests/test_image_service.py -v
"""

from __future__ import annotations

import io
import struct
import zlib

import pytest
from PIL import Image

from app.services.image_service import validate_image

MAX_SIZE = 10 * 1024 * 1024  # 10 MB


# â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _make_jpeg_bytes(width: int = 256, height: int = 256) -> bytes:
    """Create a minimal valid JPEG image in memory."""
    img = Image.new("RGB", (width, height), color=(128, 128, 128))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_png_bytes(width: int = 256, height: int = 256) -> bytes:
    """Create a minimal valid PNG image in memory."""
    img = Image.new("RGB", (width, height), color=(100, 100, 100))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_oversized_bytes(size_bytes: int) -> bytes:
    """Create a byte string larger than the upload limit."""
    return b"X" * size_bytes


# â”€â”€ Valid images â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestValidImages:
    def test_valid_jpeg_passes(self) -> None:
        result = validate_image(_make_jpeg_bytes(), "test.jpg", MAX_SIZE)
        assert result.valid is True
        assert result.format_ok is True
        assert result.decodable is True
        assert result.rejection_reason is None
        assert result.width == 256
        assert result.height == 256

    def test_valid_png_passes(self) -> None:
        result = validate_image(_make_png_bytes(), "test.png", MAX_SIZE)
        assert result.valid is True
        assert result.format_ok is True
        assert result.decodable is True

    def test_valid_image_has_dimensions(self) -> None:
        result = validate_image(_make_jpeg_bytes(512, 384), "test.jpg", MAX_SIZE)
        assert result.width == 512
        assert result.height == 384

    def test_valid_image_has_aspect_ratio(self) -> None:
        result = validate_image(_make_jpeg_bytes(512, 256), "test.jpg", MAX_SIZE)
        assert result.aspect_ratio == pytest.approx(2.0, rel=1e-3)

    def test_valid_image_has_file_size(self) -> None:
        data = _make_jpeg_bytes()
        result = validate_image(data, "test.jpg", MAX_SIZE)
        assert result.file_size_bytes == len(data)


# â”€â”€ File-size checks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestFileSize:
    def test_empty_file_rejected(self) -> None:
        result = validate_image(b"", "empty.jpg", MAX_SIZE)
        assert result.valid is False
        assert result.size_ok is False
        assert result.rejection_reason is not None

    def test_oversized_file_rejected(self) -> None:
        oversized = _make_oversized_bytes(MAX_SIZE + 1)
        result = validate_image(oversized, "big.jpg", MAX_SIZE)
        assert result.valid is False
        assert result.size_ok is False
        assert "exceeds" in result.rejection_reason.lower()


# â”€â”€ Format checks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestInvalidFormat:
    def test_plain_text_rejected(self) -> None:
        result = validate_image(b"This is not an image.", "text.jpg", MAX_SIZE)
        assert result.valid is False
        assert result.decodable is False

    def test_random_bytes_rejected(self) -> None:
        result = validate_image(b"\x00\x01\x02\x03\xff\xfe\xfd", "bad.png", MAX_SIZE)
        assert result.valid is False
        assert result.decodable is False

    def test_gif_rejected(self) -> None:
        """GIF is not in the allowed set even though Pillow can read it."""
        img = Image.new("RGB", (64, 64))
        buf = io.BytesIO()
        img.save(buf, format="GIF")
        result = validate_image(buf.getvalue(), "anim.gif", MAX_SIZE)
        assert result.valid is False
        assert result.format_ok is False


# â”€â”€ Dimension checks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestDimensions:
    def test_too_small_rejected(self) -> None:
        result = validate_image(_make_jpeg_bytes(16, 16), "tiny.jpg", MAX_SIZE)
        assert result.valid is False
        assert "too small" in result.rejection_reason.lower()

    def test_minimum_valid_dimension(self) -> None:
        result = validate_image(_make_jpeg_bytes(64, 64), "min.jpg", MAX_SIZE)
        assert result.valid is True


# â”€â”€ Return-value completeness â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestReturnValues:
    def test_failed_validation_has_rejection_reason(self) -> None:
        result = validate_image(b"", "empty.jpg", MAX_SIZE)
        assert isinstance(result.rejection_reason, str)
        assert len(result.rejection_reason) > 0

    def test_passed_validation_no_rejection_reason(self) -> None:
        result = validate_image(_make_jpeg_bytes(), "ok.jpg", MAX_SIZE)
        assert result.rejection_reason is None

