"""
SwasthyaScan AI — External Evaluation Script
===========================================
Evaluates the trained DenseNet121 on the Montgomery County (external) test set.
Montgomery is NEVER used for training or validation — it is a separate test set
to measure cross-dataset generalisation.

Run AFTER training:
    python data/evaluate_model.py

Outputs:
    model_artifacts/evaluation_results.json  — honest, reproducible metrics
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
from sklearn.metrics import (
    classification_report, confusion_matrix, roc_auc_score,
)
from torch.utils.data import DataLoader, Dataset

ROOT       = Path(__file__).parent
PROCESSED  = ROOT / "processed"
ARTIFACTS  = ROOT.parent / "model_artifacts"

MODEL_PATH  = ARTIFACTS / "densenet121_tb.pth"
EVAL_PATH   = ARTIFACTS / "evaluation_results.json"

IMG_SIZE = 224
BATCH    = 8
MEAN     = [0.485, 0.456, 0.406]
STD      = [0.229, 0.224, 0.225]


def log(msg: str) -> None:
    print(f"[eval] {msg}", flush=True)


class InferenceDataset(Dataset):
    def __init__(self, csv_path: Path, transform=None):
        self.df = pd.read_csv(csv_path)
        self.transform = transform

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int):
        row = self.df.iloc[idx]
        try:
            img = Image.open(row["path"]).convert("RGB")
        except Exception:
            img = Image.new("RGB", (IMG_SIZE, IMG_SIZE), 0)
        if self.transform:
            img = self.transform(img)
        return img, int(row["label"]), str(row["path"])


transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(MEAN, STD),
])


def build_model():
    model = models.densenet121(weights=None)
    in_features = model.classifier.in_features
    model.classifier = nn.Sequential(
        nn.Dropout(0.5),
        nn.Linear(in_features, 1),
    )
    return model


def main() -> None:
    log("=" * 60)
    log("SwasthyaScan AI — Model Evaluation (Montgomery external test set)")
    log("=" * 60)

    if not MODEL_PATH.exists():
        log(f"ERROR: Model not found at {MODEL_PATH}. Run train_model.py first.")
        return

    test_csv = PROCESSED / "test.csv"
    if not test_csv.exists():
        log("ERROR: test.csv not found. Run prepare_dataset.py first.")
        return

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log(f"Device: {device}")

    # Load model
    model = build_model().to(device)
    ckpt = torch.load(MODEL_PATH, map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    log(f"Loaded model from epoch {ckpt.get('epoch', '?')} (val_loss={ckpt.get('val_loss', '?'):.4f})")

    # Dataset
    ds     = InferenceDataset(test_csv, transform=transform)
    loader = DataLoader(ds, batch_size=BATCH, shuffle=False, num_workers=2)
    test_df = pd.read_csv(test_csv)
    log(f"Test set: {len(test_df)} images  (TB={test_df['label'].sum()}, Normal={len(test_df)-test_df['label'].sum()})")

    all_labels, all_probs = [], []
    with torch.no_grad():
        for imgs, labels, _ in loader:
            imgs = imgs.to(device)
            logits = model(imgs)
            probs  = torch.sigmoid(logits).cpu().numpy().flatten()
            all_labels.extend(labels.numpy().tolist())
            all_probs.extend(probs.tolist())

    all_preds = [1 if p >= 0.5 else 0 for p in all_probs]

    # Metrics — only report what was actually calculated
    try:
        auc = roc_auc_score(all_labels, all_probs)
    except ValueError as e:
        auc = None
        log(f"AUC could not be computed: {e}")

    cm = confusion_matrix(all_labels, all_preds, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel() if cm.size == 4 else (0, 0, 0, 0)
    sensitivity = float(tp) / (tp + fn) if (tp + fn) > 0 else None
    specificity = float(tn) / (tn + fp) if (tn + fp) > 0 else None
    ppv = float(tp) / (tp + fp) if (tp + fp) > 0 else None
    npv = float(tn) / (tn + fn) if (tn + fn) > 0 else None
    accuracy = float(tp + tn) / len(all_labels) if all_labels else None

    report = classification_report(all_labels, all_preds, labels=[0, 1],
                                   target_names=["Normal", "TB"], output_dict=True)

    log(f"\n--- Evaluation Results ---")
    log(f"Accuracy:    {accuracy:.4f}" if accuracy is not None else "Accuracy: N/A")
    log(f"AUC-ROC:     {auc:.4f}"      if auc is not None else "AUC-ROC: N/A")
    log(f"Sensitivity: {sensitivity:.4f}" if sensitivity is not None else "Sensitivity: N/A")
    log(f"Specificity: {specificity:.4f}" if specificity is not None else "Specificity: N/A")
    log(f"PPV:         {ppv:.4f}" if ppv is not None else "PPV: N/A")
    log(f"NPV:         {npv:.4f}" if npv is not None else "NPV: N/A")
    log(f"Confusion matrix:\n  TN={tn}  FP={fp}\n  FN={fn}  TP={tp}")

    results = {
        "model_path": str(MODEL_PATH),
        "model_epoch": ckpt.get("epoch"),
        "test_set": "Montgomery County CXR Set (external, not used in training/validation)",
        "test_n": len(all_labels),
        "test_tb": int(sum(all_labels)),
        "test_normal": int(len(all_labels) - sum(all_labels)),
        "threshold": 0.5,
        "threshold_note": "Fixed at 0.5 — not optimised on test set to avoid data leakage",
        "metrics": {
            "accuracy":    round(accuracy, 6) if accuracy is not None else None,
            "auc_roc":     round(auc, 6)      if auc is not None else None,
            "sensitivity": round(sensitivity, 6) if sensitivity is not None else None,
            "specificity": round(specificity, 6) if specificity is not None else None,
            "ppv":         round(ppv, 6)  if ppv is not None else None,
            "npv":         round(npv, 6)  if npv is not None else None,
        },
        "confusion_matrix": {"TN": int(tn), "FP": int(fp), "FN": int(fn), "TP": int(tp)},
        "classification_report": report,
        "caveats": [
            "Montgomery is a small dataset (~138 images). Metrics may not generalise.",
            "Potential training-data overlap between NLM Shenzhen and Kaggle tawsifurrahman was not fully ruled out.",
            "Model score is not a calibrated probability.",
            "These metrics do not constitute clinical validation.",
        ],
    }

    with open(EVAL_PATH, "w") as f:
        json.dump(results, f, indent=2)

    log(f"\nResults saved to {EVAL_PATH}")


if __name__ == "__main__":
    main()
