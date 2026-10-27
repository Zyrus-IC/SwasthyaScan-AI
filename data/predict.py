"""
PulmoSure — predict.py
======================
Runs inference on a single image or a folder of images.
Preprocessing is loaded from tb_config.json to GUARANTEE it
matches the training pipeline exactly.

Usage:
    # Single image
    python data/predict.py --image path/to/xray.jpg

    # Folder of images
    python data/predict.py --folder path/to/folder

    # Batch test (prints table)
    python data/predict.py --folder path/to/folder --verbose
"""

import argparse
import json
import sys
from pathlib import Path

import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as T
from PIL import Image

# ── Defaults ──────────────────────────────────────────────────────────────
ARTIFACTS   = Path("E:/PROJECT/PulmoSure/model_artifacts")
CONFIG_PATH = ARTIFACTS / "tb_config.json"
MODEL_PATH  = ARTIFACTS / "tb_model_best.pth"


# ══════════════════════════════════════════════════════════════════════════
# Load config + model  (done once at import time for fast repeated calls)
# ══════════════════════════════════════════════════════════════════════════

def _load_config():
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(
            f"Config not found: {CONFIG_PATH}\n"
            "Run  python data/train.py  first."
        )
    return json.loads(CONFIG_PATH.read_text())


def _build_model(config, device):
    weights = models.EfficientNet_B0_Weights.IMAGENET1K_V1
    model   = models.efficientnet_b0(weights=weights)
    in_feat = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(0.4),
        nn.Linear(in_feat, 1),
    )
    ckpt = torch.load(config["weights"], map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    return model.to(device)


def _build_transform(config):
    """
    MUST match get_eval_transform() in train.py exactly.
    Values come from config.json so there is no manual sync needed.
    """
    return T.Compose([
        T.Resize((config["img_size"], config["img_size"])),
        T.ToTensor(),
        T.Normalize(mean=config["mean"], std=config["std"]),
    ])


# ── Module-level singletons (loaded once) ────────────────────────────────
_config    = None
_model     = None
_transform = None
_device    = None
_threshold = None


def _ensure_loaded():
    global _config, _model, _transform, _device, _threshold
    if _model is None:
        _device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        _config    = _load_config()
        _model     = _build_model(_config, _device)
        _transform = _build_transform(_config)
        _threshold = _config["threshold"]


# ══════════════════════════════════════════════════════════════════════════
# Public API
# ══════════════════════════════════════════════════════════════════════════

def predict_image(image_path: str) -> dict:
    """
    Returns:
        {
            "prediction":  "TB" | "Normal",
            "score":       float in [0, 1],   # TB probability
            "threshold":   float,
            "label_meaning": str,
        }
    """
    _ensure_loaded()

    try:
        img = Image.open(image_path).convert("RGB")
    except Exception as e:
        return {"error": f"Cannot open image: {e}"}

    tensor = _transform(img).unsqueeze(0).to(_device)

    with torch.no_grad():
        logit = _model(tensor)
        score = float(torch.sigmoid(logit).item())

    prediction = "TB" if score >= _threshold else "Normal"
    return {
        "prediction":   prediction,
        "score":        round(score, 6),
        "threshold":    round(_threshold, 6),
        "label_meaning": (
            f"Score {score:.3f} >= threshold {_threshold:.3f} → TB-consistent"
            if prediction == "TB"
            else
            f"Score {score:.3f} < threshold {_threshold:.3f} → Normal"
        ),
    }


def predict_bytes(image_bytes: bytes) -> dict:
    """Same as predict_image but accepts raw bytes (for FastAPI integration)."""
    import io
    _ensure_loaded()
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        return {"error": f"Cannot decode image bytes: {e}"}
    tensor = _transform(img).unsqueeze(0).to(_device)
    with torch.no_grad():
        score = float(torch.sigmoid(_model(tensor)).item())
    prediction = "TB" if score >= _threshold else "Normal"
    return {
        "prediction": prediction,
        "score":      round(score, 6),
        "threshold":  round(_threshold, 6),
    }


# ══════════════════════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════════════════════

def cli_single(image_path: str):
    result = predict_image(image_path)
    print(f"\nImage:      {Path(image_path).name}")
    if "error" in result:
        print(f"ERROR: {result['error']}")
        return
    print(f"Prediction: {result['prediction']}")
    print(f"TB score:   {result['score']:.4f}  (threshold={result['threshold']:.4f})")
    print(f"Meaning:    {result['label_meaning']}")


def cli_folder(folder_path: str, verbose: bool = False):
    folder = Path(folder_path)
    exts   = {".jpg", ".jpeg", ".png"}
    files  = sorted(p for p in folder.rglob("*") if p.suffix.lower() in exts)
    if not files:
        print(f"No images found in {folder}")
        return

    print(f"\n{'File':<40} {'Score':>7} {'Pred':>8}")
    print("-" * 60)
    for f in files:
        r = predict_image(str(f))
        if "error" in r:
            print(f"{f.name:<40} {'ERROR':>7} {r['error']:>8}")
        else:
            print(f"{f.name:<40} {r['score']:>7.4f} {r['prediction']:>8}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PulmoSure TB predictor")
    parser.add_argument("--image",   help="Path to a single X-ray image")
    parser.add_argument("--folder",  help="Path to a folder of X-ray images")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    if args.image:
        cli_single(args.image)
    elif args.folder:
        cli_folder(args.folder, args.verbose)
    else:
        parser.print_help()
