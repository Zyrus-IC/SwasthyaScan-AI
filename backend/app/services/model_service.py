"""
PulmoSure AI — Model Inference Service
=======================================
Loads the trained DenseNet121 model and runs inference on a decoded image.

Design rules (non-negotiable):
  - Never fabricate predictions. If weights are missing → return None.
  - Model score is NOT a calibrated probability. Document this clearly.
  - Handle GPU/CPU fallback automatically.
  - Clean up tensors promptly; avoid memory leaks.
  - Never expose internal stack traces to the API layer.

Preprocessing matches training pipeline exactly:
  - Resize to 224×224
  - Convert to RGB
  - Normalise with ImageNet mean/std

Threshold:
  MODEL_THRESHOLD env var (default 0.5). After training, set to the value
  selected on the validation set (sensitivity ≥ 90% rule). This is the
  same threshold that was used during evaluation and must not be changed
  without re-running the full evaluation step.
"""

from __future__ import annotations

import io
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ── Lazy imports — only load heavy libs when model is actually needed ──────
_torch_loaded = False
_model_instance = None
_device = None

# ImageNet normalisation constants (must match training)
_MEAN = [0.485, 0.456, 0.406]
_STD  = [0.229, 0.224, 0.225]
_IMG_SIZE = 224

# Decision threshold — loaded from env at import time.
# After training, set MODEL_THRESHOLD=<val> in backend/.env.
# The value must match the threshold selected on the validation set in Step 7.
_DEFAULT_THRESHOLD = 0.5

def _get_threshold() -> float:
    """Read threshold from MODEL_THRESHOLD env var; fall back to 0.5."""
    try:
        val = float(os.environ.get("MODEL_THRESHOLD", _DEFAULT_THRESHOLD))
        if not (0.0 < val < 1.0):
            logger.warning("MODEL_THRESHOLD=%s is out of (0,1); using default 0.5", val)
            return _DEFAULT_THRESHOLD
        return val
    except (ValueError, TypeError):
        return _DEFAULT_THRESHOLD


def _load_torch():
    """Import torch/torchvision only once."""
    global _torch_loaded
    if not _torch_loaded:
        try:
            import torch          # noqa: F401
            import torchvision    # noqa: F401
            _torch_loaded = True
        except ImportError as e:
            raise RuntimeError(
                "PyTorch is not installed. Install it with: "
                "pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124"
            ) from e


def _build_model():
    """Construct DenseNet121 with the same head used during training."""
    import torch.nn as nn
    import torchvision.models as models
    model = models.densenet121(weights=None)
    in_features = model.classifier.in_features
    model.classifier = nn.Sequential(
        nn.Dropout(0.5),
        nn.Linear(in_features, 1),
    )
    return model


def load_model(weights_path: str) -> bool:
    """
    Load model weights from disk. Call once at startup.
    Returns True on success, False if weights file is missing or corrupt.
    """
    global _model_instance, _device

    path = Path(weights_path)
    if not path.exists():
        logger.warning(
            "Model weights not found at %s — inference will be unavailable.", weights_path
        )
        return False

    try:
        _load_torch()
        import torch

        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info("Loading DenseNet121 weights from %s on %s", weights_path, _device)

        model = _build_model()
        ckpt  = torch.load(path, map_location=_device, weights_only=False)
        model.load_state_dict(ckpt["model_state_dict"])
        model.eval()
        model.to(_device)

        _model_instance = model
        epoch = ckpt.get("epoch", "?")
        val_loss = ckpt.get("val_loss", "?")
        logger.info(
            "Model loaded successfully — epoch=%s  val_loss=%s  device=%s",
            epoch, val_loss, _device
        )
        return True

    except Exception as exc:
        logger.error("Failed to load model weights: %s", exc, exc_info=True)
        _model_instance = None
        return False


def is_model_loaded() -> bool:
    """Return True if the model has been successfully loaded."""
    return _model_instance is not None


def run_inference(image_bytes: bytes) -> Optional[dict]:
    """
    Run DenseNet121 inference on raw image bytes.

    Parameters
    ----------
    image_bytes : Raw bytes of a JPEG or PNG chest X-ray.

    Returns
    -------
    dict with keys:
        prediction  : "TB" or "Normal"
        score       : float in [0, 1]  (NOT a calibrated probability)
        label_meaning: str explaining what the score means
    OR None if inference could not be run.

    Raises
    ------
    RuntimeError if PyTorch is not installed.
    """
    if _model_instance is None:
        logger.warning("run_inference called but model is not loaded.")
        return None

    try:
        _load_torch()
        import torch
        import torchvision.transforms as transforms
        from PIL import Image as PILImage

        # Pre-processing — must match training exactly
        transform = transforms.Compose([
            transforms.Resize((_IMG_SIZE, _IMG_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=_MEAN, std=_STD),
        ])

        img = PILImage.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = transform(img).unsqueeze(0).to(_device)  # (1, 3, H, W)

        threshold = _get_threshold()

        with torch.no_grad():
            logit = _model_instance(tensor)
            score = float(torch.sigmoid(logit).item())

        prediction = "TB" if score >= threshold else "Normal"
        label_meaning = (
            f"The model returned a score of {score:.3f} "
            f"(threshold: {threshold:.3f}, selected on validation set for ≥90% sensitivity). "
            f"Scores ≥ {threshold:.3f} are classified as TB-consistent. "
            f"This score is NOT a calibrated probability and does not confirm or rule out tuberculosis."
        )

        logger.info(
            "Inference complete: prediction=%s score=%.4f threshold=%.4f",
            prediction, score, threshold
        )

        return {
            "prediction":    prediction,
            "score":         round(score, 6),
            "threshold":     round(threshold, 4),
            "label_meaning": label_meaning,
        }

    except Exception as exc:
        logger.error("Inference error: %s", exc, exc_info=True)
        return None
