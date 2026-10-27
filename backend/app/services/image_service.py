"""
SwasthyaScan AI ”” Image Service
==============================
Stage 5 / Stage 6: Image validation and safe decoding.

Only technically verifiable checks are implemented:
  1.  File-size check (before touching the content).
  2.  MIME-type check (from content bytes, not just the extension).
  3.  Image decodability via Pillow.
  4.  Basic dimension sanity.

Checks NOT implemented (not defensible at this stage):
  - Blur detection.
  - Positioning / anatomy correctness.
  - Clinical-quality assessment.
  - DICOM metadata interpretation.

If an image cannot be assessed reliably, report the limitation rather than
inventing a quality score.
"""

from __future__ import annotations

import io
import logging

from PIL import Image, UnidentifiedImageError

from app.schemas.screening import ImageValidationResult

logger = logging.getLogger(__name__)

# Allowed MIME types ”” checked via Pillow format detection, not file extension.
ALLOWED_PIL_FORMATS: frozenset[str] = frozenset({"JPEG", "PNG"})

# Minimum and maximum dimension thresholds.
# These are basic technical sanity checks, not clinical quality standards.
MIN_DIMENSION_PX = 64
MAX_DIMENSION_PX = 8192


def validate_image(
    data: bytes,
    filename: str,
    max_size_bytes: int,
) -> ImageValidationResult:
    """
    Run all implemented image validation checks and return a structured result.

    Parameters
    ----------
    data:           Raw bytes of the uploaded file.
    filename:       Original filename (used in error messages only).
    max_size_bytes: Maximum allowed file size in bytes.

    Returns
    -------
    ImageValidationResult with all check fields populated.
    """
    file_size = len(data)

    # â”€â”€ 1. File-size check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if file_size > max_size_bytes:
        max_mb = max_size_bytes / (1024 * 1024)
        actual_mb = file_size / (1024 * 1024)
        return ImageValidationResult(
            valid=False,
            format_ok=False,
            size_ok=False,
            decodable=False,
            file_size_bytes=file_size,
            rejection_reason=(
                f"File size {actual_mb:.1f} MB exceeds the {max_mb:.0f} MB limit."
            ),
        )

    # â”€â”€ 2. Empty-file check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if file_size == 0:
        return ImageValidationResult(
            valid=False,
            format_ok=False,
            size_ok=False,
            decodable=False,
            file_size_bytes=0,
            rejection_reason="The uploaded file is empty.",
        )

    size_ok = True

    # â”€â”€ 3. Format and decodability via Pillow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try:
        with Image.open(io.BytesIO(data)) as img:
            pil_format = img.format  # e.g. "JPEG", "PNG", None
            if pil_format not in ALLOWED_PIL_FORMATS:
                return ImageValidationResult(
                    valid=False,
                    format_ok=False,
                    size_ok=size_ok,
                    decodable=False,
                    file_size_bytes=file_size,
                    rejection_reason=(
                        f"Unsupported image format '{pil_format}'. "
                        "Please upload a JPEG or PNG chest X-ray."
                    ),
                )

            format_ok = True

            # Force full decode to catch truncated files.
            img.load()

            width, height = img.size

            # â”€â”€ 4. Dimension sanity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            if width < MIN_DIMENSION_PX or height < MIN_DIMENSION_PX:
                return ImageValidationResult(
                    valid=False,
                    format_ok=format_ok,
                    size_ok=size_ok,
                    decodable=True,
                    width=width,
                    height=height,
                    file_size_bytes=file_size,
                    rejection_reason=(
                        f"Image dimensions {width}\u00d7{height} px are too small "
                        f"(minimum {MIN_DIMENSION_PX}\u00d7{MIN_DIMENSION_PX} px)."
                    ),
                )

            if width > MAX_DIMENSION_PX or height > MAX_DIMENSION_PX:
                return ImageValidationResult(
                    valid=False,
                    format_ok=format_ok,
                    size_ok=size_ok,
                    decodable=True,
                    width=width,
                    height=height,
                    file_size_bytes=file_size,
                    rejection_reason=(
                        f"Image dimensions {width}\u00d7{height} px exceed the "
                        f"{MAX_DIMENSION_PX}\u00d7{MAX_DIMENSION_PX} px maximum."
                    ),
                )

            aspect_ratio = round(width / height, 4) if height > 0 else None

            logger.info(
                "Image validated: file=%s fmt=%s size=%d bytes dim=%dx%d",
                filename,
                pil_format,
                file_size,
                width,
                height,
            )

            return ImageValidationResult(
                valid=True,
                format_ok=True,
                size_ok=True,
                decodable=True,
                width=width,
                height=height,
                aspect_ratio=aspect_ratio,
                file_size_bytes=file_size,
            )

    except UnidentifiedImageError:
        return ImageValidationResult(
            valid=False,
            format_ok=False,
            size_ok=size_ok,
            decodable=False,
            file_size_bytes=file_size,
            rejection_reason=(
                "The uploaded file could not be identified as a valid image. "
                "Please upload a JPEG or PNG file."
            ),
        )
    except Exception as exc:  # noqa: BLE001
        # Log the technical detail server-side; return a safe message to the client.
        logger.warning("Image validation error for file=%s: %s", filename, exc)
        return ImageValidationResult(
            valid=False,
            format_ok=False,
            size_ok=size_ok,
            decodable=False,
            file_size_bytes=file_size,
            rejection_reason=(
                "The image could not be processed. "
                "It may be corrupted or in an unsupported format."
            ),
        )

