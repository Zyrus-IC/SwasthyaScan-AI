"""
PulmoSure — train.py  (ALL DATASETS COMBINED)
==============================================
Sources combined:
  1. Dataset of Tuberculosis Chest X-rays Images/Normal Chest X-rays/  -> Normal (0)
  2. Dataset of Tuberculosis Chest X-rays Images/TB Chest X-rays/      -> TB (1)
  3. data/raw/kaggle_tb/TB_Chest_Radiography_Database/Normal/           -> Normal (0)
  4. data/raw/kaggle_tb/TB_Chest_Radiography_Database/Tuberculosis/     -> TB (1)
  5. data/raw/montgomery/ MCUCXR_XXXX_0.png -> Normal, _1.png -> TB

Total: ~7300 images  (much more balanced than 514 vs 2494)

Run:
    python data/train.py

Output in model_artifacts/:
    tb_model_best.pth
    tb_config.json
    tb_training_log.json
    tb_eval_report.md
"""

import json
import os
import random
import re
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image, UnidentifiedImageError
from sklearn.metrics import (
    accuracy_score, confusion_matrix, f1_score,
    precision_score, recall_score, roc_auc_score,
)
from sklearn.model_selection import train_test_split

# ── Paths ──────────────────────────────────────────────────────────────────
ROOT      = Path("E:/PROJECT/PulmoSure")
ARTIFACTS = ROOT / "model_artifacts"
ARTIFACTS.mkdir(exist_ok=True)

MODEL_PATH  = ARTIFACTS / "tb_model_best.pth"
CONFIG_PATH = ARTIFACTS / "tb_config.json"
LOG_PATH    = ARTIFACTS / "tb_training_log.json"
REPORT_PATH = ARTIFACTS / "tb_eval_report.md"

# ── Hyper-parameters ───────────────────────────────────────────────────────
IMG_SIZE    = 224
BATCH_SIZE  = 16
EPOCHS_MAX  = 25
LR          = 1e-4
LR_BACKBONE = 1e-5
PATIENCE    = 4
SEED        = 42

# Preprocessing — IDENTICAL in predict.py (loaded from tb_config.json)
MEAN = [0.485, 0.456, 0.406]
STD  = [0.229, 0.224, 0.225]

IMG_EXTS = {".jpg", ".jpeg", ".png"}


# ══════════════════════════════════════════════════════════════════════════
# 1. LOAD ALL DATASETS
# ══════════════════════════════════════════════════════════════════════════

def collect(directory: Path, label: int, source_name: str) -> list[tuple[str, int]]:
    """Recursively collect all image paths with a fixed label."""
    if not directory.exists():
        print(f"  [SKIP] {source_name} — folder not found: {directory}", flush=True)
        return []
    pairs = [
        (str(p), label)
        for p in directory.rglob("*")
        if p.suffix.lower() in IMG_EXTS and p.is_file()
    ]
    print(f"  {len(pairs):5d}  {source_name}", flush=True)
    return pairs


def montgomery_label(filename: str) -> int | None:
    """MCUCXR_XXXX_0.png -> 0 (Normal), MCUCXR_XXXX_1.png -> 1 (TB)"""
    m = re.search(r"_(\d)\.png$", filename, re.IGNORECASE)
    if m:
        return int(m.group(1))
    return None


def load_all() -> tuple[list[str], list[int]]:
    print("\n[DATA] Loading all sources ...", flush=True)
    pairs: list[tuple[str, int]] = []

    # Source 1+2: Your main dataset
    pairs += collect(
        ROOT / "Dataset of Tuberculosis Chest X-rays Images" / "Normal Chest X-rays",
        0, "Your dataset — Normal"
    )
    pairs += collect(
        ROOT / "Dataset of Tuberculosis Chest X-rays Images" / "TB Chest X-rays",
        1, "Your dataset — TB"
    )

    # Source 3+4: Kaggle tawsifurrahman (folder-based labels)
    pairs += collect(
        ROOT / "data/raw/kaggle_tb/TB_Chest_Radiography_Database/Normal",
        0, "Kaggle TB dataset — Normal"
    )
    pairs += collect(
        ROOT / "data/raw/kaggle_tb/TB_Chest_Radiography_Database/Tuberculosis",
        1, "Kaggle TB dataset — TB"
    )

    # Source 5: Montgomery (filename-based labels)
    mont_dir = ROOT / "data/raw/montgomery"
    if mont_dir.exists():
        mont_pairs = []
        for p in mont_dir.rglob("*.png"):
            lbl = montgomery_label(p.name)
            if lbl is not None:
                mont_pairs.append((str(p), lbl))
        n0 = sum(1 for _, l in mont_pairs if l == 0)
        n1 = sum(1 for _, l in mont_pairs if l == 1)
        print(f"  {len(mont_pairs):5d}  Montgomery (Normal={n0}, TB={n1})", flush=True)
        pairs += mont_pairs
    else:
        print(f"  [SKIP] Montgomery — not found", flush=True)

    # Deduplicate by path
    seen, unique = set(), []
    for path, lbl in pairs:
        if path not in seen:
            seen.add(path)
            unique.append((path, lbl))

    random.shuffle(unique)
    paths  = [p for p, _ in unique]
    labels = [l for _, l in unique]

    counts = Counter(labels)
    print(f"\n[DATA] ---- COMBINED TOTAL ----", flush=True)
    print(f"[DATA] Normal (0): {counts[0]}", flush=True)
    print(f"[DATA] TB     (1): {counts[1]}", flush=True)
    print(f"[DATA] Total:      {len(labels)}", flush=True)
    ratio = counts[1] / max(counts[0], 1)
    print(f"[DATA] TB/Normal ratio: {ratio:.2f}:1", flush=True)

    if counts[0] == 0 or counts[1] == 0:
        raise RuntimeError("One class has zero images — check dataset paths!")

    return paths, labels


# ══════════════════════════════════════════════════════════════════════════
# 2. VERIFY IMAGES (remove corrupt)
# ══════════════════════════════════════════════════════════════════════════

def verify(paths: list[str], labels: list[int]) -> tuple[list[str], list[int]]:
    print(f"\n[VERIFY] Checking {len(paths)} images ...", flush=True)
    good_p, good_l, bad = [], [], 0
    for i, (p, l) in enumerate(zip(paths, labels)):
        if i % 500 == 0:
            print(f"  {i}/{len(paths)} checked...", flush=True)
        try:
            with Image.open(p) as img:
                img.load()
            good_p.append(p)
            good_l.append(l)
        except (UnidentifiedImageError, OSError):
            bad += 1
    print(f"[VERIFY] Corrupt/unreadable: {bad}  Valid: {len(good_p)}", flush=True)
    return good_p, good_l


# ══════════════════════════════════════════════════════════════════════════
# 3. SPLIT  70 / 15 / 15  stratified, no leakage
# ══════════════════════════════════════════════════════════════════════════

def make_splits(paths, labels):
    X_tmp, X_test, y_tmp, y_test = train_test_split(
        paths, labels, test_size=0.15, stratify=labels, random_state=SEED
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_tmp, y_tmp, test_size=0.15/0.85, stratify=y_tmp, random_state=SEED
    )
    # Verify no overlap
    assert not (set(X_train) & set(X_val)),   "LEAK: train/val overlap!"
    assert not (set(X_train) & set(X_test)),  "LEAK: train/test overlap!"
    assert not (set(X_val)   & set(X_test)),  "LEAK: val/test overlap!"

    print(f"\n[SPLIT] Train: {len(X_train)}  "
          f"(TB={sum(y_train)}, Normal={len(y_train)-sum(y_train)})", flush=True)
    print(f"[SPLIT] Val:   {len(X_val)}  "
          f"(TB={sum(y_val)}, Normal={len(y_val)-sum(y_val)})", flush=True)
    print(f"[SPLIT] Test:  {len(X_test)}  "
          f"(TB={sum(y_test)}, Normal={len(y_test)-sum(y_test)})", flush=True)
    print(f"[SPLIT] No overlap confirmed.", flush=True)
    return (X_train, y_train), (X_val, y_val), (X_test, y_test)


# ══════════════════════════════════════════════════════════════════════════
# 4. DATASET + TRANSFORMS
# ══════════════════════════════════════════════════════════════════════════

import torch
import torchvision.transforms as T
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler


class XRayDataset(Dataset):
    def __init__(self, paths, labels, transform):
        self.paths = paths; self.labels = labels; self.transform = transform

    def __len__(self): return len(self.paths)

    def __getitem__(self, idx):
        try:
            img = Image.open(self.paths[idx]).convert("RGB")
        except Exception:
            img = Image.new("RGB", (IMG_SIZE, IMG_SIZE), 128)
        return self.transform(img), torch.tensor(self.labels[idx], dtype=torch.float32)


def get_train_transform():
    return T.Compose([
        T.Resize((IMG_SIZE + 20, IMG_SIZE + 20)),
        T.RandomCrop((IMG_SIZE, IMG_SIZE)),
        T.RandomHorizontalFlip(p=0.3),
        T.RandomRotation(10),
        T.ColorJitter(brightness=0.2, contrast=0.2),
        T.ToTensor(),
        T.Normalize(MEAN, STD),
    ])


def get_eval_transform():
    """MUST match predict.py exactly."""
    return T.Compose([
        T.Resize((IMG_SIZE, IMG_SIZE)),
        T.ToTensor(),
        T.Normalize(MEAN, STD),
    ])


# ══════════════════════════════════════════════════════════════════════════
# 5. MODEL  (EfficientNet-B0)
# ══════════════════════════════════════════════════════════════════════════

import torch.nn as nn
import torchvision.models as models


def build_model(device):
    weights = models.EfficientNet_B0_Weights.IMAGENET1K_V1
    model   = models.efficientnet_b0(weights=weights)
    in_feat = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(0.4),
        nn.Linear(in_feat, 1),
    )
    return model.to(device)


# ══════════════════════════════════════════════════════════════════════════
# 6. TRAINING LOOP
# ══════════════════════════════════════════════════════════════════════════

@torch.no_grad()
def infer(model, loader, criterion, device):
    model.eval()
    total_loss, all_labels, all_probs = 0.0, [], []
    for imgs, labels in loader:
        imgs   = imgs.to(device)
        lab_d  = labels.unsqueeze(1).to(device)
        logits = model(imgs)
        loss   = criterion(logits, lab_d)
        probs  = torch.sigmoid(logits).cpu().numpy().flatten()
        total_loss += loss.item() * imgs.size(0)
        all_probs.extend(probs.tolist())
        all_labels.extend(labels.numpy().tolist())
    n = len(all_labels)
    try:    auc = float(roc_auc_score(all_labels, all_probs))
    except: auc = float("nan")
    return total_loss / max(n, 1), all_labels, all_probs, auc


def pick_threshold(val_labels, val_probs, target_recall=0.90):
    best_t, best_f1, best_rec = 0.5, 0.0, 0.0
    for t in sorted(set(val_probs)):
        preds = [1 if p >= t else 0 for p in val_probs]
        tp = sum(1 for l, p in zip(val_labels, preds) if l == 1 and p == 1)
        fn = sum(1 for l, p in zip(val_labels, preds) if l == 1 and p == 0)
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1  = f1_score(val_labels, preds, zero_division=0)
        if rec >= target_recall and f1 > best_f1:
            best_t, best_f1, best_rec = t, f1, rec
    if best_f1 == 0.0:  # fallback: max F1
        for t in sorted(set(val_probs)):
            preds = [1 if p >= t else 0 for p in val_probs]
            f1 = f1_score(val_labels, preds, zero_division=0)
            if f1 > best_f1:
                best_t, best_f1 = t, f1
    print(f"[THRESHOLD] {best_t:.4f}  val_F1={best_f1:.4f}  val_recall={best_rec:.4f}",
          flush=True)
    return float(best_t)


def full_eval(labels, probs, threshold, split_name="TEST"):
    preds = [1 if p >= threshold else 0 for p in probs]
    acc   = accuracy_score(labels, preds)
    prec  = precision_score(labels, preds, zero_division=0)
    rec   = recall_score(labels, preds, zero_division=0)
    f1    = f1_score(labels, preds, zero_division=0)
    try:    auc = roc_auc_score(labels, probs)
    except: auc = float("nan")
    cm = confusion_matrix(labels, preds, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()

    print(f"\n{'='*55}", flush=True)
    print(f"  {split_name} RESULTS  (threshold={threshold:.4f})", flush=True)
    print(f"{'='*55}", flush=True)
    print(f"  Accuracy:  {acc:.4f}", flush=True)
    print(f"  Precision: {prec:.4f}", flush=True)
    print(f"  Recall:    {rec:.4f}  <- must be >= 0.90 for TB", flush=True)
    print(f"  F1:        {f1:.4f}", flush=True)
    print(f"  ROC-AUC:   {auc:.4f}", flush=True)
    print(f"  Confusion matrix:", flush=True)
    print(f"              Pred Normal  Pred TB", flush=True)
    print(f"  True Normal   {tn:8d}  {fp:7d}", flush=True)
    print(f"  True TB       {fn:8d}  {tp:7d}", flush=True)
    return dict(accuracy=round(acc,4), precision=round(prec,4),
                recall=round(rec,4), f1=round(f1,4),
                roc_auc=round(float(auc),4),
                tn=int(tn), fp=int(fp), fn=int(fn), tp=int(tp))


@torch.no_grad()
def spot_check(model, test_paths, test_labels, threshold, device):
    transform = get_eval_transform()
    normal_idx = [i for i, l in enumerate(test_labels) if l == 0][:5]
    tb_idx     = [i for i, l in enumerate(test_labels) if l == 1][:5]

    print(f"\n{'='*65}", flush=True)
    print("  SPOT CHECK — 5 Normal + 5 TB", flush=True)
    print(f"  {'File':<38} {'True':>7} {'Score':>7} {'Pred':>8}", flush=True)
    print(f"  {'-'*63}", flush=True)

    model.eval()
    for idx in normal_idx + tb_idx:
        img    = Image.open(test_paths[idx]).convert("RGB")
        tensor = transform(img).unsqueeze(0).to(device)
        score  = float(torch.sigmoid(model(tensor)).item())
        pred   = "TB" if score >= threshold else "Normal"
        true   = "TB" if test_labels[idx] == 1 else "Normal"
        ok     = "OK" if pred == true else "WRONG"
        name   = Path(test_paths[idx]).name[:36]
        print(f"  {name:<38} {true:>7} {score:>7.4f} {pred:>8}  {ok}", flush=True)


# ══════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════

def main():
    random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[DEVICE] {device}", flush=True)
    if device.type == "cuda":
        torch.cuda.manual_seed_all(SEED)
        print(f"[GPU] {torch.cuda.get_device_name(0)}", flush=True)

    # 1. Load all
    paths, labels = load_all()

    # 2. Verify
    paths, labels = verify(paths, labels)

    # 3. Split
    (X_train, y_train), (X_val, y_val), (X_test, y_test) = make_splits(paths, labels)

    # 4. Datasets + loaders
    train_ds = XRayDataset(X_train, y_train, get_train_transform())
    val_ds   = XRayDataset(X_val,   y_val,   get_eval_transform())
    test_ds  = XRayDataset(X_test,  y_test,  get_eval_transform())

    # Weighted sampler — oversample minority class
    counts  = Counter(y_train)
    w       = [1.0 / counts[l] for l in y_train]
    sampler = WeightedRandomSampler(w, num_samples=len(w), replacement=True)

    train_ld = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler,
                          num_workers=0, pin_memory=(device.type=="cuda"))
    val_ld   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                          num_workers=0, pin_memory=(device.type=="cuda"))
    test_ld  = DataLoader(test_ds,  batch_size=BATCH_SIZE, shuffle=False,
                          num_workers=0, pin_memory=(device.type=="cuda"))

    # 5. Model + loss
    model      = build_model(device)
    pos_weight = torch.tensor([counts[0] / max(counts[1], 1)], device=device)
    criterion  = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    print(f"[LOSS] pos_weight={pos_weight.item():.3f}  "
          f"(Normal={counts[0]}, TB={counts[1]})", flush=True)

    backbone_p = [p for n, p in model.named_parameters() if "classifier" not in n]
    head_p     = list(model.classifier.parameters())
    optimizer  = torch.optim.AdamW(
        [{"params": backbone_p, "lr": LR_BACKBONE},
         {"params": head_p,     "lr": LR}],
        weight_decay=1e-4,
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS_MAX)
    scaler    = torch.amp.GradScaler("cuda", enabled=(device.type == "cuda"))

    # 6. Train
    best_auc, patience_cnt, log_data = -1.0, 0, []
    t_start = time.time()
    print(f"\n[TRAIN] Starting {EPOCHS_MAX} epochs max  patience={PATIENCE}", flush=True)

    for epoch in range(1, EPOCHS_MAX + 1):
        t0 = time.time()
        model.train()
        total_loss, n = 0.0, 0
        optimizer.zero_grad(set_to_none=True)

        for step, (imgs, lab) in enumerate(train_ld):
            imgs  = imgs.to(device)
            lab_d = lab.unsqueeze(1).to(device)
            with torch.amp.autocast("cuda", enabled=(device.type == "cuda")):
                logits = model(imgs)
                loss   = criterion(logits, lab_d) / 2
            scaler.scale(loss).backward()
            if (step + 1) % 2 == 0 or (step + 1) == len(train_ld):
                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad(set_to_none=True)
            total_loss += loss.item() * 2 * imgs.size(0)
            n += imgs.size(0)

        train_loss = total_loss / max(n, 1)
        val_loss, val_labels, val_probs, val_auc = infer(model, val_ld, criterion, device)
        scheduler.step()

        epoch_t = time.time() - t0
        print(f"  Epoch {epoch:03d}/{EPOCHS_MAX}  "
              f"train={train_loss:.4f}  val={val_loss:.4f}  "
              f"val_auc={val_auc:.4f}  ({epoch_t:.0f}s)", flush=True)

        log_data.append({"epoch": epoch, "train_loss": round(train_loss, 5),
                         "val_loss": round(val_loss, 5), "val_auc": round(val_auc, 5),
                         "time_s": round(epoch_t, 1)})

        if val_auc > best_auc:
            best_auc, patience_cnt = val_auc, 0
            torch.save({
                "epoch": epoch, "model_state_dict": model.state_dict(),
                "val_auc": val_auc, "val_labels": val_labels, "val_probs": val_probs,
            }, MODEL_PATH)
            print(f"    -> Best saved  val_auc={val_auc:.4f}", flush=True)
        else:
            patience_cnt += 1
            print(f"    patience {patience_cnt}/{PATIENCE}", flush=True)
            if patience_cnt >= PATIENCE:
                print(f"  Early stopping at epoch {epoch}", flush=True)
                break

    print(f"\n[TRAIN] Done in {(time.time()-t_start)/60:.1f} min  "
          f"best_auc={best_auc:.4f}", flush=True)

    # 7. Load best, pick threshold, evaluate test
    ckpt = torch.load(MODEL_PATH, map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model_state_dict"])
    threshold = pick_threshold(ckpt["val_labels"], ckpt["val_probs"], 0.90)

    _, tl, tp_out, _ = infer(model, test_ld, criterion, device)
    metrics = full_eval(tl, tp_out, threshold, "TEST")

    # 8. Spot check
    spot_check(model, X_test, y_test, threshold, device)

    # 9. Save config
    config = {
        "model": "efficientnet_b0", "img_size": IMG_SIZE,
        "mean": MEAN, "std": STD, "threshold": threshold,
        "label_map": {"0": "Normal", "1": "TB"},
        "class_index": {"Normal": 0, "TB": 1},
        "weights": str(MODEL_PATH),
        "best_val_auc": round(best_auc, 6),
        "test_metrics": metrics,
        "dataset_sources": [
            "Dataset of Tuberculosis Chest X-rays Images/Normal Chest X-rays",
            "Dataset of Tuberculosis Chest X-rays Images/TB Chest X-rays",
            "data/raw/kaggle_tb/TB_Chest_Radiography_Database/Normal",
            "data/raw/kaggle_tb/TB_Chest_Radiography_Database/Tuberculosis",
            "data/raw/montgomery (filename-based labels)",
        ],
    }
    CONFIG_PATH.write_text(json.dumps(config, indent=2))
    LOG_PATH.write_text(json.dumps(log_data, indent=2))

    # Report
    lines = [
        "# PulmoSure TB Model — Evaluation Report",
        "", "## Combined Dataset",
        f"- Total valid images: {len(paths)}",
        f"- Normal: {Counter(labels)[0]}  TB: {Counter(labels)[1]}",
        f"- Split: 70/15/15 stratified",
        "", "## Training",
        f"- Model: EfficientNet-B0 (ImageNet pretrained)",
        f"- Best val AUC: {best_auc:.4f}",
        f"- Threshold: {threshold:.4f} (val recall >= 90%)",
        "", "## Test Set Results",
        "| Metric | Value |", "|--------|-------|",
        f"| Accuracy | {metrics['accuracy']} |",
        f"| Precision | {metrics['precision']} |",
        f"| Recall (TB sensitivity) | {metrics['recall']} |",
        f"| F1 | {metrics['f1']} |",
        f"| ROC-AUC | {metrics['roc_auc']} |",
        "", "| | Pred Normal | Pred TB |", "|--|--|--|",
        f"| True Normal | {metrics['tn']} | {metrics['fp']} |",
        f"| True TB | {metrics['fn']} | {metrics['tp']} |",
    ]
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n[SAVED] {MODEL_PATH}", flush=True)
    print(f"[SAVED] {CONFIG_PATH}", flush=True)
    print(f"[SAVED] {REPORT_PATH}", flush=True)
    print("\n[DONE]", flush=True)


if __name__ == "__main__":
    main()
