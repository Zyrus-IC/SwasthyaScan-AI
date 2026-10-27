"""
SwasthyaScan AI — DenseNet121 Training Script
=============================================
Fine-tunes a pre-trained DenseNet121 (ImageNet weights) for binary TB / Normal
classification on the prepared TB chest X-ray dataset.

Usage:
    python data/train_model.py [--test-run]
    
    --test-run   Quick sanity check with ~100 images, 2 epochs. 
                 Run this first to verify everything works before full training.

Outputs:
    model_artifacts/densenet121_tb.pth   — trained weights
    model_artifacts/training_log.json    — metrics per epoch
    model_artifacts/model_card.json      — metadata for honest reporting

IMPORTANT NOTES:
  - Only metrics that are actually computed are reported.
  - Model output is NOT a calibrated probability.
  - This is a research prototype trained on small public datasets.
  - Do not claim clinical validation.
"""

from __future__ import annotations

import argparse
import json
import random
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
from sklearn.metrics import (
    confusion_matrix, roc_auc_score,
    classification_report, f1_score,
)
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler

# ── Paths ─────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).parent
PROCESSED  = ROOT / "processed"
ARTIFACTS  = ROOT.parent / "model_artifacts"
ARTIFACTS.mkdir(exist_ok=True)

MODEL_PATH = ARTIFACTS / "densenet121_tb.pth"
LOG_PATH   = ARTIFACTS / "training_log.json"
CARD_PATH  = ARTIFACTS / "model_card.json"

# ── Hyperparameters ───────────────────────────────────────────────────────
IMG_SIZE   = 224
BATCH_SIZE = 8        # safe for 4 GB VRAM with DenseNet121
LR         = 1e-4
LR_FEATURE = 1e-5     # lower LR for frozen backbone layers
EPOCHS     = 30
PATIENCE   = 7        # early stopping
SEED       = 42

# ── ImageNet normalisation (DenseNet121 standard) ─────────────────────────
MEAN = [0.485, 0.456, 0.406]
STD  = [0.229, 0.224, 0.225]


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def log(msg: str) -> None:
    print(f"[train] {msg}", flush=True)


# ── Custom Dataset ────────────────────────────────────────────────────────
class TBDataset(Dataset):
    """Loads CXR images from a manifest CSV."""

    def __init__(self, csv_path: Path, transform=None):
        self.df = pd.read_csv(csv_path)
        self.transform = transform
        # Validate all paths exist
        missing = [p for p in self.df["path"] if not Path(p).exists()]
        if missing:
            log(f"WARNING: {len(missing)} paths in {csv_path.name} do not exist")

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int):
        row = self.df.iloc[idx]
        try:
            img = Image.open(row["path"]).convert("RGB")
        except Exception:
            # Return a black image on decode failure to avoid crashing training
            img = Image.new("RGB", (IMG_SIZE, IMG_SIZE), 0)
        if self.transform:
            img = self.transform(img)
        label = int(row["label"])
        return img, label


# ── Transforms ────────────────────────────────────────────────────────────
train_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
    transforms.RandomCrop(IMG_SIZE),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(10),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.ToTensor(),
    transforms.Normalize(MEAN, STD),
])

val_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(MEAN, STD),
])


# ── Model ─────────────────────────────────────────────────────────────────
def build_model() -> nn.Module:
    """Load pre-trained DenseNet121 and replace classifier for binary output."""
    model = models.densenet121(weights=models.DenseNet121_Weights.IMAGENET1K_V1)
    # Replace the classifier head for binary classification
    in_features = model.classifier.in_features
    model.classifier = nn.Sequential(
        nn.Dropout(0.5),
        nn.Linear(in_features, 1),  # single logit for BCEWithLogitsLoss
    )
    return model


# ── Weighted sampler (handles class imbalance) ────────────────────────────
def make_weighted_sampler(df: pd.DataFrame) -> WeightedRandomSampler:
    """Over-sample the minority class during training."""
    counts = df["label"].value_counts()
    class_weights = {cls: 1.0 / cnt for cls, cnt in counts.items()}
    sample_weights = df["label"].map(class_weights).values
    return WeightedRandomSampler(
        weights=torch.DoubleTensor(sample_weights),
        num_samples=len(sample_weights),
        replacement=True,
    )


# ── Training loop ─────────────────────────────────────────────────────────
def train_epoch(model, loader, optimizer, criterion, device) -> tuple[float, float]:
    model.train()
    total_loss, correct, total = 0.0, 0, 0
    for imgs, labels in loader:
        imgs   = imgs.to(device)
        labels = labels.float().unsqueeze(1).to(device)
        optimizer.zero_grad(set_to_none=True)
        logits = model(imgs)
        loss   = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * imgs.size(0)
        preds = (torch.sigmoid(logits) >= 0.5).long()
        correct += (preds == labels.long()).sum().item()
        total   += imgs.size(0)
    return total_loss / total, correct / total


@torch.no_grad()
def eval_epoch(model, loader, criterion, device) -> tuple[float, float, list, list]:
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    all_labels, all_probs = [], []
    for imgs, labels in loader:
        imgs   = imgs.to(device)
        labels_t = labels.float().unsqueeze(1).to(device)
        logits = model(imgs)
        loss   = criterion(logits, labels_t)
        total_loss += loss.item() * imgs.size(0)
        probs  = torch.sigmoid(logits).cpu().numpy()
        preds  = (torch.sigmoid(logits) >= 0.5).long()
        correct += (preds == labels_t.long()).sum().item()
        total   += imgs.size(0)
        all_labels.extend(labels.numpy().tolist())
        all_probs.extend(probs.flatten().tolist())
    return total_loss / total, correct / total, all_labels, all_probs


# ── Main ──────────────────────────────────────────────────────────────────
def main(test_run: bool = False) -> None:
    set_seed(SEED)
    log("=" * 60)
    log("SwasthyaScan AI — DenseNet121 Training")
    log("=" * 60)

    # Device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log(f"Device: {device}")
    if device.type == "cuda":
        log(f"GPU: {torch.cuda.get_device_name(0)}")
        log(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    # Load manifests
    train_csv = PROCESSED / "train.csv"
    val_csv   = PROCESSED / "val.csv"
    if not train_csv.exists() or not val_csv.exists():
        log("ERROR: Run data/prepare_dataset.py first to generate manifests.")
        return

    train_df = pd.read_csv(train_csv)
    val_df   = pd.read_csv(val_csv)

    if test_run:
        log("TEST RUN: Sampling 100 train + 40 val images")
        train_df = train_df.sample(min(100, len(train_df)), random_state=SEED)
        val_df   = val_df.sample(min(40,  len(val_df)),   random_state=SEED)
        epochs   = 2
    else:
        epochs = EPOCHS

    log(f"Train: {len(train_df)} images  (TB={train_df['label'].sum()}, Normal={len(train_df)-train_df['label'].sum()})")
    log(f"Val:   {len(val_df)}   images  (TB={val_df['label'].sum()},   Normal={len(val_df)-val_df['label'].sum()})")

    # Save manifests to temp CSVs for Dataset to read
    _train_tmp = PROCESSED / "_train_tmp.csv"
    _val_tmp   = PROCESSED / "_val_tmp.csv"
    train_df.to_csv(_train_tmp, index=False)
    val_df.to_csv(_val_tmp,   index=False)

    # Datasets and loaders
    train_ds = TBDataset(_train_tmp, transform=train_transform)
    val_ds   = TBDataset(_val_tmp,   transform=val_transform)

    sampler    = make_weighted_sampler(train_df)
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler,
                              num_workers=2, pin_memory=(device.type == "cuda"))
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=2, pin_memory=(device.type == "cuda"))

    # Model, loss, optimiser
    model = build_model().to(device)
    criterion = nn.BCEWithLogitsLoss()

    # Two-phase learning rates: lower LR for pretrained features
    backbone_params = [p for n, p in model.named_parameters() if "classifier" not in n]
    head_params     = list(model.classifier.parameters())
    optimizer = torch.optim.AdamW([
        {"params": backbone_params, "lr": LR_FEATURE},
        {"params": head_params,     "lr": LR},
    ], weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=3, verbose=True
    )

    # Training
    best_val_loss = float("inf")
    patience_counter = 0
    training_log: list[dict] = []

    log(f"\nStarting training for {epochs} epochs …")
    for epoch in range(1, epochs + 1):
        t0 = time.time()

        train_loss, train_acc = train_epoch(model, train_loader, optimizer, criterion, device)
        val_loss, val_acc, val_labels, val_probs = eval_epoch(model, val_loader, criterion, device)

        scheduler.step(val_loss)

        # Compute metrics
        val_preds = [1 if p >= 0.5 else 0 for p in val_probs]
        try:
            auc = roc_auc_score(val_labels, val_probs)
        except ValueError:
            auc = float("nan")  # only one class in this val batch

        cm = confusion_matrix(val_labels, val_preds, labels=[0, 1])
        tn, fp, fn, tp = (cm.ravel() if cm.size == 4 else (0, 0, 0, 0))
        sensitivity = tp / (tp + fn) if (tp + fn) > 0 else float("nan")
        specificity = tn / (tn + fp) if (tn + fp) > 0 else float("nan")

        elapsed = time.time() - t0
        log(
            f"Epoch {epoch:03d}/{epochs}  "
            f"loss={val_loss:.4f}  acc={val_acc:.4f}  "
            f"AUC={auc:.4f}  sens={sensitivity:.3f}  spec={specificity:.3f}  "
            f"({elapsed:.0f}s)"
        )

        record = {
            "epoch": epoch,
            "train_loss": round(train_loss, 6),
            "train_acc":  round(train_acc,  6),
            "val_loss":   round(val_loss,   6),
            "val_acc":    round(val_acc,    6),
            "val_auc":    round(auc, 6) if not np.isnan(auc) else None,
            "sensitivity": round(sensitivity, 6) if not np.isnan(sensitivity) else None,
            "specificity": round(specificity, 6) if not np.isnan(specificity) else None,
        }
        training_log.append(record)

        # Save best model
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_loss": val_loss,
                "val_auc": auc,
                "hyperparameters": {
                    "img_size":   IMG_SIZE,
                    "batch_size": BATCH_SIZE,
                    "lr":         LR,
                    "lr_feature": LR_FEATURE,
                    "seed":       SEED,
                },
            }, MODEL_PATH)
            log(f"  ✓ Saved best model (val_loss={val_loss:.4f})")
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE and not test_run:
                log(f"Early stopping at epoch {epoch} (patience={PATIENCE})")
                break

    # Save training log
    with open(LOG_PATH, "w") as f:
        json.dump(training_log, f, indent=2)

    # Produce model card (honest metadata)
    best_epoch = min(training_log, key=lambda x: x["val_loss"])
    model_card = {
        "model_name": "DenseNet121-TB-SwasthyaScan",
        "architecture": "DenseNet121",
        "pretrained_weights": "ImageNet (torchvision DenseNet121_Weights.IMAGENET1K_V1)",
        "task": "Binary classification: TB vs Normal",
        "output": "Single logit; apply sigmoid to get a score in [0,1]. Score >= 0.5 → TB prediction.",
        "score_interpretation": (
            "The score is NOT a calibrated probability. It cannot be interpreted as "
            "a clinical probability of having tuberculosis. A high score does not "
            "confirm TB; a low score does not rule it out."
        ),
        "input_format": {
            "size": f"{IMG_SIZE}x{IMG_SIZE}",
            "channels": "RGB",
            "normalisation_mean": MEAN,
            "normalisation_std": STD,
        },
        "training": {
            "seed": SEED,
            "batch_size": BATCH_SIZE,
            "lr_classifier": LR,
            "lr_backbone": LR_FEATURE,
            "epochs_run": len(training_log),
            "early_stopping_patience": PATIENCE,
        },
        "best_epoch_metrics": best_epoch,
        "dataset_sources": [
            "NLM Shenzhen Hospital CXR Set (https://data.lhncbc.nlm.nih.gov/...)",
            "Kaggle: tawsifurrahman/tuberculosis-tb-chest-xray-dataset (CC BY 4.0)",
        ],
        "external_test_set": "NLM Montgomery County CXR Set — NOT used in training or validation",
        "limitations": [
            "Trained on small public research datasets (hundreds to low thousands of images).",
            "Not clinically validated.",
            "Performance on populations different from training data is unknown.",
            "Potential overlap between public datasets may affect evaluation reliability.",
            "Score is not calibrated.",
            "This is a research prototype — not a medical device.",
        ],
        "intended_use": "Research prototype for demonstrating reliability-aware AI screening support.",
        "prohibited_use": "Clinical diagnosis, patient triage, or any medical decision-making.",
    }
    with open(CARD_PATH, "w") as f:
        json.dump(model_card, f, indent=2)

    # Clean up temp files
    _train_tmp.unlink(missing_ok=True)
    _val_tmp.unlink(missing_ok=True)

    log(f"\n{'='*60}")
    log(f"Training complete.")
    log(f"Best val_loss:     {best_val_loss:.4f}  (epoch {best_epoch['epoch']})")
    log(f"Best val_auc:      {best_epoch.get('val_auc', 'N/A')}")
    log(f"Best sensitivity:  {best_epoch.get('sensitivity', 'N/A')}")
    log(f"Best specificity:  {best_epoch.get('specificity', 'N/A')}")
    log(f"\nModel saved:  {MODEL_PATH}")
    log(f"Model card:   {CARD_PATH}")
    log(f"Training log: {LOG_PATH}")
    log(f"\nNext step: Update MODEL_WEIGHTS_PATH in backend/.env to point to:")
    log(f"  {MODEL_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--test-run", action="store_true",
                        help="Quick sanity check with ~100 images (do this first!)")
    args = parser.parse_args()
    main(test_run=args.test_run)
