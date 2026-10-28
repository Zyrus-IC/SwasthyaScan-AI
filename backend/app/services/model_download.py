"""Download model weights at startup if missing (used on Render)."""
import logging
import os
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)


def ensure_weights() -> None:
    path = os.environ.get("MODEL_WEIGHTS_PATH", "").strip()
    url = os.environ.get("MODEL_WEIGHTS_URL", "").strip()
    if not path or not url:
        return
    target = Path(path)
    if target.exists():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(".part")
    try:
        logger.info("Downloading model weights...")
        urllib.request.urlretrieve(url, tmp)
        tmp.replace(target)
        logger.info("Model weights downloaded.")
    except Exception as exc:
        logger.warning("Weights download failed: %s", exc)
        tmp.unlink(missing_ok=True)