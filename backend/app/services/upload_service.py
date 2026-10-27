"""
SwasthyaScan AI — Upload Service
==================================
Re-encodes uploaded images to strip EXIF/metadata.
Stores with random UUID filenames in a private uploads directory.
The directory path is NEVER exposed to clients.
"""
from __future__ import annotations

import io
import logging
import uuid
from pathlib import Path

from PIL import Image as PILImage

logger = logging.getLogger(__name__)

_UPLOADS_DIR: Path | None = None


def init_uploads(uploads_dir: Path) -> None:
    global _UPLOADS_DIR
    uploads_dir.mkdir(parents=True, exist_ok=True)
    _UPLOADS_DIR = uploads_dir


def save_image(image_bytes: bytes) -> str:
    """
    Re-encode image to strip EXIF/metadata, save with random UUID filename.
    Returns the random filename (no path). Raises on failure.
    """
    assert _UPLOADS_DIR, "Uploads directory not initialised — call init_uploads() first."

    # Re-encode via PIL to strip all metadata
    img = PILImage.open(io.BytesIO(image_bytes)).convert("RGB")
    filename = f"{uuid.uuid4()}.png"
    out_path = _UPLOADS_DIR / filename

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    out_path.write_bytes(buf.getvalue())

    logger.info("Image saved (EXIF stripped): %s  %d bytes", filename, len(buf.getvalue()))
    return filename


def load_image_bytes(filename: str) -> bytes:
    """Load image bytes by random filename. Raises FileNotFoundError if missing."""
    assert _UPLOADS_DIR, "Uploads directory not initialised."
    path = _UPLOADS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {filename}")
    return path.read_bytes()


def delete_image(filename: str) -> None:
    """Delete image file. Silently ignores if already gone."""
    if not _UPLOADS_DIR or not filename:
        return
    p = _UPLOADS_DIR / filename
    try:
        p.unlink(missing_ok=True)
    except Exception as exc:
        logger.warning("Could not delete image %s: %s", filename, exc)


def get_uploads_dir() -> Path:
    assert _UPLOADS_DIR
    return _UPLOADS_DIR
