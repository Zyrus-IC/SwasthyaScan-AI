"""
PulmoSure AI — Full Training Pipeline (Steps 3–7)
===================================================
Covers:
  Step 3: Manifest + exact dedup (MD5) + near-dedup (perceptual hash)
           Cross-dataset contamination: Kaggle images matching Montgomery are removed
  Step 4: 85/15 stratified train/val split (seed=42). Montgomery = test only.
           Pre-resize all images to 224×224 and cache them (fast epochs).
  Step 5: Smoke test — 1 epoch on ~100 images, prints time estimate
  Step 6: Fine-tune DenseNet121 (ImageNet weights), AMP, class weights,
           mild augmentation (rotation+jitter, NO horizontal flip),
           gradient accumulation 2, AdamW, early stopping on val AUC (patience 3),
           hard 60-min cap. Saves best weights to model_artifacts/.
  Step 7: Threshold selection on VALIDATION only (rule: sensitivity ≥ 90%).
           Report metrics on validation AND Montgomery (honest cross-dataset shift).
           Saves metrics_report.json and evaluation_report.md.

Usage:
    python data/full_pipeline.py --manifest-only      # steps 3+4
    python data/full_pipeline.py --smoke-test         # step 5
    python data/full_pipeline.py --train              # step 6
    python data/full_pipeline.py --eval               # step 7
    python data/full_pipeline.py --smoke-test --train --eval   # full run
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import time
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image, UnidentifiedImageError

# ── Paths ─────────────────────────────────────────────────────────────────
ROOT          = Path(__file__).parent
RAW           = ROOT / "raw"
PROCESSED     = ROOT / "processed"
CACHE_DIR     = PROCESSED / "cache_224"
ARTIFACTS     = ROOT.parent / "model_artifacts"

for d in (PROCESSED, CACHE_DIR, ARTIFACTS):
    d.mkdir(parents=True, exist_ok=True)

SHENZHEN_DIR   = RAW / "shenzhen"
MONTGOMERY_DIR = RAW / "montgomery"
KAGGLE_TB_DIR  = RAW / "kaggle_tb"

MODEL_PATH   = ARTIFACTS / "densenet121_tb_best.pth"
LOG_PATH     = ARTIFACTS / "training_log.json"
CARD_PATH    = ARTIFACTS / "model_card.json"
METRICS_PATH = ARTIFACTS / "metrics_report.json"
REPORT_PATH  = ARTIFACTS / "evaluation_report.md"

# ── Hyper-parameters ──────────────────────────────────────────────────────
IMG_SIZE        = 224
BATCH_SIZE      = 8
GRAD_ACCUM      = 2       # effective batch = 16
LR              = 1e-4
LR_FEATURE      = 1e-5
PATIENCE        = 3       # early stopping on val AUC
EPOCHS_MAX      = 60
SEED            = 42
TRAIN_RATIO     = 0.85
MIN_SENS        = 0.90    # threshold rule on validation
PHASH_THRESHOLD = 8       # perceptual-hash hamming distance ≤ this = near-dup
HARD_CAP_SEC    = 60 * 60 # 60-minute wall-clock cap

MEAN = [0.485, 0.456, 0.406]
STD  = [0.229, 0.224, 0.225]


def log(msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)


# ══════════════════════════════════════════════════════════════════════════
# STEP 3  MANIFEST + DEDUPLICATION
# ══════════════════════════════════════════════════════════════════════════

def file_md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        while blk := f.read(65536):
            h.update(blk)
    return h.hexdigest()


def image_phash(path: Path):
    """Perceptual hash; None on failure."""
    try:
        import imagehash
        with Image.open(path) as img:
            return imagehash.phash(img.convert("RGB"))
    except Exception:
        return None


# ── Label parsers ─────────────────────────────────────────────────────────
def shenzhen_label(filename: str) -> int | None:
    """CHNCXR_XXXX_0.png → 0 (Normal), CHNCXR_XXXX_1.png → 1 (TB)"""
    m = re.search(r"_(\d)\.png$", filename, re.IGNORECASE)
    return int(m.group(1)) if m else None


def montgomery_label(filename: str) -> int | None:
    """MCUCXR_XXXX_0.png → 0, MCUCXR_XXXX_1.png → 1"""
    m = re.search(r"_(\d)\.png$", filename, re.IGNORECASE)
    return int(m.group(1)) if m else None


def kaggle_tb_label(path: Path) -> int | None:
    """Folder 'Tuberculosis' → 1, 'Normal' → 0"""
    for part in path.parts:
        if part.lower() == "tuberculosis":
            return 1
        if part.lower() == "normal":
            return 0
    return None


# Shenzhen from raddar Kaggle mirror — the images may be in ChinaSet_AllFiles/CXR_png/
def shenzhen_label_auto(path: Path) -> int | None:
    """Try filename-based label; fall back to folder-based for raddar mirror."""
    label = shenzhen_label(path.name)
    if label is not None:
        return label
    # raddar mirror uses folder structure Normal/ and Tuberculosis/
    for part in path.parts:
        if part.lower() in ("normal", "normal_cxr"):
            return 0
        if part.lower() in ("tuberculosis", "tb", "abnormal"):
            return 1
    return None


def montgomery_label_auto(path: Path) -> int | None:
    """Try filename-based label; fall back to folder-based for raddar mirror."""
    label = montgomery_label(path.name)
    if label is not None:
        return label
    for part in path.parts:
        if part.lower() in ("normal", "normal_cxr"):
            return 0
        if part.lower() in ("tuberculosis", "tb", "abnormal"):
            return 1
    return None


def scan_directory(directory: Path, source_name: str, label_fn) -> list[dict]:
    records = []
    skipped = 0
    for p in sorted(directory.rglob("*")):
        if p.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
            continue
        label = label_fn(p)
        if label is None:
            skipped += 1
            continue
        records.append({
            "path":      str(p.resolve()),
            "source":    source_name,
            "filename":  p.name,
            "label":     label,
            "label_str": "TB" if label == 1 else "Normal",
        })
    if skipped:
        log(f"  {source_name}: {skipped} files with unparseable labels skipped")
    return records


def build_manifest() -> tuple[pd.DataFrame, dict]:
    log("=" * 60)
    log("STEP 3: MANIFEST + DEDUPLICATION")
    log("=" * 60)

    sz = scan_directory(SHENZHEN_DIR,   "shenzhen_nlm",           lambda p: shenzhen_label_auto(p))
    mg = scan_directory(MONTGOMERY_DIR, "montgomery_nlm",          lambda p: montgomery_label_auto(p))
    kg = scan_directory(KAGGLE_TB_DIR,  "kaggle_tawsifurrahman",   kaggle_tb_label)

    log(f"Raw scan — Shenzhen: {len(sz)}, Montgomery: {len(mg)}, Kaggle: {len(kg)}")
    for src, recs in [("Shenzhen", sz), ("Montgomery", mg), ("Kaggle", kg)]:
        tb = sum(r["label"] for r in recs)
        log(f"  {src}: TB={tb}, Normal={len(recs)-tb}")

    all_records = sz + mg + kg
    if not all_records:
        raise RuntimeError("No images found. Run data/download_datasets.py first.")

    # ── Verify decodability ───────────────────────────────────────────────
    log(f"\nVerifying decodability of all {len(all_records)} images …")
    valid, corrupt = [], 0
    for i, rec in enumerate(all_records):
        if i % 100 == 0:
            print(f"\r  {i}/{len(all_records)}", end="", flush=True)
        try:
            with Image.open(rec["path"]) as img:
                img.load()
            valid.append(rec)
        except Exception:
            log(f"\n  CORRUPT: {rec['filename']}")
            corrupt += 1
    print()
    log(f"  Corrupt: {corrupt}  Valid: {len(valid)}")

    # ── Exact dedup (MD5) ─────────────────────────────────────────────────
    log(f"\nComputing MD5 hashes for exact-duplicate removal …")
    seen_md5: dict[str, str] = {}
    exact_removed = 0
    after_exact = []
    for i, rec in enumerate(valid):
        if i % 100 == 0:
            print(f"\r  {i}/{len(valid)}", end="", flush=True)
        h = file_md5(Path(rec["path"]))
        rec["md5"] = h
        if h in seen_md5:
            exact_removed += 1
            log(f"\n  EXACT DUP: {rec['filename']} == {Path(seen_md5[h]).name}")
        else:
            seen_md5[h] = rec["path"]
            after_exact.append(rec)
    print()
    log(f"  Exact duplicates removed: {exact_removed}  Remaining: {len(after_exact)}")

    # ── Near-dedup (perceptual hash) + Montgomery contamination check ──────
    log(f"\nComputing perceptual hashes (threshold={PHASH_THRESHOLD}) …")
    try:
        import imagehash as _ih  # noqa: F401
        has_imagehash = True
    except ImportError:
        log("  WARNING: imagehash not installed — skipping perceptual dedup")
        has_imagehash = False

    near_removed = 0
    montgomery_contamination = 0
    after_phash = []

    if has_imagehash:
        # Build Montgomery phash index first
        log("  Building Montgomery perceptual-hash index …")
        mg_phashes: list[tuple] = []
        for rec in after_exact:
            if rec["source"] == "montgomery_nlm":
                ph = image_phash(Path(rec["path"]))
                if ph is not None:
                    rec["phash"] = str(ph)
                    mg_phashes.append((ph, rec["filename"]))
        log(f"  Montgomery phash index: {len(mg_phashes)} entries")

        kept_phashes: list[tuple] = []  # (phash_obj, filename)

        for i, rec in enumerate(after_exact):
            if i % 100 == 0:
                print(f"\r  {i}/{len(after_exact)}", end="", flush=True)

            ph = image_phash(Path(rec["path"]))
            if ph is None:
                after_phash.append(rec)
                continue
            rec["phash"] = str(ph)

            # Check cross-dataset contamination: Kaggle/Shenzhen vs Montgomery
            if rec["source"] in ("kaggle_tawsifurrahman", "shenzhen_nlm"):
                contaminated = False
                for mgh, mgname in mg_phashes:
                    if (ph - mgh) <= PHASH_THRESHOLD:
                        log(f"\n  MONTGOMERY MATCH (removed from train/val): "
                            f"{rec['source']}/{rec['filename']} ≈ montgomery/{mgname}")
                        montgomery_contamination += 1
                        near_removed += 1
                        contaminated = True
                        break
                if contaminated:
                    continue

            # Near-dup within kept images
            is_near_dup = False
            for kph, kname in kept_phashes:
                if (ph - kph) <= PHASH_THRESHOLD:
                    log(f"\n  NEAR DUP: {rec['filename']} ≈ {kname} (hamming≤{PHASH_THRESHOLD})")
                    near_removed += 1
                    is_near_dup = True
                    break
            if not is_near_dup:
                kept_phashes.append((ph, rec["filename"]))
                after_phash.append(rec)
        print()
    else:
        after_phash = after_exact

    log(f"  Near-duplicates removed: {near_removed} "
        f"(of which {montgomery_contamination} matched Montgomery images)")
    log(f"  Final unique images: {len(after_phash)}")

    df = pd.DataFrame(after_phash)
    if df.empty:
        raise RuntimeError("Manifest is empty after dedup — check raw data.")

    # Final per-source class counts
    stats: dict = {
        "raw": {
            "shenzhen": len(sz), "montgomery": len(mg), "kaggle": len(kg),
            "total": len(sz) + len(mg) + len(kg),
        },
        "removed": {
            "corrupt": corrupt,
            "exact_duplicates": exact_removed,
            "near_duplicates_and_montgomery_matches": near_removed,
        },
        "final_total": len(df),
    }
    log("\nFinal per-source stats:")
    for src in sorted(df["source"].unique()):
        sub = df[df["source"] == src]
        entry = {
            "total": len(sub),
            "TB": int((sub["label"] == 1).sum()),
            "Normal": int((sub["label"] == 0).sum()),
        }
        stats[f"final_{src}"] = entry
        log(f"  {src}: {entry}")

    return df, stats


# ══════════════════════════════════════════════════════════════════════════
# STEP 4  SPLIT + PRE-RESIZE CACHE
# ══════════════════════════════════════════════════════════════════════════

def make_splits(df: pd.DataFrame) -> pd.DataFrame:
    log("=" * 60)
    log("STEP 4: STRATIFIED SPLIT (85/15) + PRE-RESIZE CACHE")
    log("=" * 60)
    rng = random.Random(SEED)

    test_df      = df[df["source"] == "montgomery_nlm"].copy()
    train_val_df = df[df["source"] != "montgomery_nlm"].copy()

    test_df["split"] = "test"
    train_rows, val_rows = [], []

    for label in [0, 1]:
        group = train_val_df[train_val_df["label"] == label].to_dict("records")
        rng.shuffle(group)
        n_train = round(len(group) * TRAIN_RATIO)
        for r in group[:n_train]:
            r["split"] = "train"
            train_rows.append(r)
        for r in group[n_train:]:
            r["split"] = "val"
            val_rows.append(r)

    log(f"  Train: {len(train_rows)} "
        f"(TB={sum(r['label'] for r in train_rows)}, "
        f"Normal={sum(1-r['label'] for r in train_rows)})")
    log(f"  Val:   {len(val_rows)} "
        f"(TB={sum(r['label'] for r in val_rows)}, "
        f"Normal={sum(1-r['label'] for r in val_rows)})")
    log(f"  Test:  {len(test_df)} (Montgomery — external only)")

    split_df = pd.DataFrame(train_rows + val_rows + test_df.to_dict("records"))
    return split_df


def pre_resize_cache(df: pd.DataFrame) -> pd.DataFrame:
    """Resize all images to 224×224 JPEG and update paths to cache."""
    log(f"\nPre-resizing {len(df)} images to {IMG_SIZE}×{IMG_SIZE} → {CACHE_DIR}")
    cached = []
    errors = 0
    for i, row in df.iterrows():
        src = Path(row["path"])
        cache_name = f"{row['source']}__{src.stem}.jpg"
        cache_path = CACHE_DIR / cache_name
        if not cache_path.exists():
            try:
                with Image.open(src) as img:
                    img = img.convert("RGB").resize((IMG_SIZE, IMG_SIZE), Image.LANCZOS)
                    img.save(cache_path, "JPEG", quality=92)
            except Exception as e:
                log(f"  Cache error {src.name}: {e}")
                errors += 1
                cached.append(row["path"])
                continue
        cached.append(str(cache_path))
        if (i % 200) == 0:
            print(f"\r  {i}/{len(df)}", end="", flush=True)
    print()
    log(f"  Cache complete. Errors: {errors}")
    df = df.copy()
    df["path"] = cached
    return df


# ══════════════════════════════════════════════════════════════════════════
# STEPS 5–6  TRAINING
# ══════════════════════════════════════════════════════════════════════════

def build_model():
    import torch.nn as nn
    import torchvision.models as models
    model = models.densenet121(weights=models.DenseNet121_Weights.IMAGENET1K_V1)
    in_features = model.classifier.in_features
    model.classifier = nn.Sequential(
        nn.Dropout(0.5),
        nn.Linear(in_features, 1),
    )
    return model


def get_transforms(training: bool):
    import torchvision.transforms as T
    if training:
        return T.Compose([
            # Images already 224×224 in cache; mild augmentation only
            T.RandomRotation(10),
            T.ColorJitter(brightness=0.2, contrast=0.2),
            # NO horizontal flip — chest X-rays are laterally asymmetric
            T.ToTensor(),
            T.Normalize(MEAN, STD),
        ])
    else:
        return T.Compose([
            T.ToTensor(),
            T.Normalize(MEAN, STD),
        ])


class TBDataset:
    """Load from pre-resized 224×224 cache."""
    def __init__(self, rows: list[dict], transform=None):
        self.rows = rows
        self.transform = transform

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, idx):
        row = self.rows[idx]
        try:
            img = Image.open(row["path"]).convert("RGB")
        except Exception:
            img = Image.new("RGB", (IMG_SIZE, IMG_SIZE), 0)
        if self.transform:
            img = self.transform(img)
        return img, int(row["label"])


def train_one_epoch(model, loader, optimizer, criterion, device, scaler, accum_steps):
    import torch
    model.train()
    total_loss, n = 0.0, 0
    optimizer.zero_grad(set_to_none=True)
    for step, (imgs, labels) in enumerate(loader):
        imgs     = imgs.to(device)
        labels_t = labels.float().unsqueeze(1).to(device)
        with torch.cuda.amp.autocast(enabled=(device.type == "cuda")):
            logits = model(imgs)
            loss   = criterion(logits, labels_t) / accum_steps
        scaler.scale(loss).backward()
        if (step + 1) % accum_steps == 0 or (step + 1) == len(loader):
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad(set_to_none=True)
        total_loss += loss.item() * accum_steps * imgs.size(0)
        n += imgs.size(0)
    return total_loss / max(n, 1)


def eval_one_epoch(model, loader, criterion, device):
    import torch
    model.eval()
    total_loss, n = 0.0, 0
    all_labels, all_probs = [], []
    with torch.no_grad():
        for imgs, labels in loader:
            imgs     = imgs.to(device)
            labels_t = labels.float().unsqueeze(1).to(device)
            with torch.cuda.amp.autocast(enabled=(device.type == "cuda")):
                logits = model(imgs)
                loss   = criterion(logits, labels_t)
            total_loss += loss.item() * imgs.size(0)
            probs = torch.sigmoid(logits).cpu().numpy().flatten()
            all_probs.extend(probs.tolist())
            all_labels.extend(labels.numpy().tolist())
            n += imgs.size(0)
    return total_loss / max(n, 1), all_labels, all_probs


def compute_metrics(labels: list, probs: list, threshold: float) -> dict:
    from sklearn.metrics import (
        confusion_matrix, roc_auc_score,
        precision_score, recall_score, f1_score, accuracy_score,
    )
    preds = [1 if p >= threshold else 0 for p in probs]
    try:
        auc = float(roc_auc_score(labels, probs))
    except ValueError:
        auc = float("nan")
    cm    = confusion_matrix(labels, preds, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel() if cm.size == 4 else (0, 0, 0, 0)
    sens  = tp / (tp + fn) if (tp + fn) > 0 else float("nan")
    spec  = tn / (tn + fp) if (tn + fp) > 0 else float("nan")
    prec  = float(precision_score(labels, preds, zero_division=0))
    f1    = float(f1_score(labels, preds, zero_division=0))
    acc   = float(accuracy_score(labels, preds))
    return {
        "threshold":        round(threshold, 4),
        "accuracy":         round(acc,  4),
        "sensitivity":      round(sens, 4),
        "specificity":      round(spec, 4),
        "precision":        round(prec, 4),
        "f1":               round(f1,   4),
        "roc_auc":          round(auc,  4) if not (isinstance(auc, float) and auc != auc) else None,
        "confusion_matrix": [[int(tn), int(fp)], [int(fn), int(tp)]],
        "n_samples":        len(labels),
        "n_TB":             int(sum(labels)),
        "n_Normal":         int(len(labels) - sum(labels)),
    }


def select_threshold(val_labels: list, val_probs: list,
                     min_sensitivity: float = MIN_SENS) -> float:
    """
    Rule: lowest threshold on validation giving sensitivity >= min_sensitivity.
    If no threshold achieves it, use the threshold maximising sensitivity.
    """
    # Candidate thresholds: every unique prob score
    candidates = sorted(set(val_probs), reverse=True)
    best_thresh = 0.5
    best_sens   = 0.0
    for t in candidates:
        tp = sum(1 for l, p in zip(val_labels, val_probs) if l == 1 and p >= t)
        fn = sum(1 for l, p in zip(val_labels, val_probs) if l == 1 and p < t)
        sens = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        if sens >= min_sensitivity:
            best_thresh = t
            break
        if sens > best_sens:
            best_sens   = sens
            best_thresh = t
    log(f"  Threshold rule: sensitivity ≥ {min_sensitivity:.0%} on validation set")
    log(f"  Selected threshold: {best_thresh:.4f}")
    return best_thresh


def run_training(split_df: pd.DataFrame, smoke_test: bool = False) -> tuple[float, list]:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, WeightedRandomSampler
    from collections import Counter

    log("=" * 60)
    log("STEP 5: SMOKE TEST" if smoke_test else "STEP 6: FULL TRAINING")
    log("=" * 60)

    set_seed(SEED)
    torch.manual_seed(SEED)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(SEED)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log(f"Device: {device}")
    if device.type == "cuda":
        log(f"GPU: {torch.cuda.get_device_name(0)}")
        log(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    train_rows = split_df[split_df["split"] == "train"].to_dict("records")
    val_rows   = split_df[split_df["split"] == "val"].to_dict("records")

    if smoke_test:
        random.shuffle(train_rows)
        random.shuffle(val_rows)
        train_rows = train_rows[:100]
        val_rows   = val_rows[:40]
        epochs_cap = 1
    else:
        epochs_cap = EPOCHS_MAX

    log(f"  Train: {len(train_rows)} images")
    log(f"  Val:   {len(val_rows)} images")

    # Weighted sampler for class imbalance
    label_list = [r["label"] for r in train_rows]
    counts = Counter(label_list)
    log(f"  Class counts — TB: {counts[1]}, Normal: {counts[0]}")
    sample_weights = [1.0 / counts[l] for l in label_list]
    sampler = WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)

    # Pos-weight for BCEWithLogitsLoss (class imbalance)
    pos_weight = torch.tensor([counts[0] / max(counts[1], 1)], device=device)
    log(f"  BCEWithLogitsLoss pos_weight: {pos_weight.item():.3f}")

    # Windows: num_workers=0 (no fork)
    train_ds = TBDataset(train_rows, transform=get_transforms(True))
    val_ds   = TBDataset(val_rows,   transform=get_transforms(False))

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler,
                              num_workers=0, pin_memory=(device.type == "cuda"))
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=0, pin_memory=(device.type == "cuda"))

    model     = build_model().to(device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    scaler    = torch.cuda.amp.GradScaler(enabled=(device.type == "cuda"))

    backbone_params = [p for n, p in model.named_parameters() if "classifier" not in n]
    head_params     = list(model.classifier.parameters())
    optimizer = torch.optim.AdamW(
        [{"params": backbone_params, "lr": LR_FEATURE},
         {"params": head_params,     "lr": LR}],
        weight_decay=1e-4,
    )

    best_val_auc     = -1.0
    patience_counter = 0
    training_log     = []
    t_start          = time.time()

    for epoch in range(1, epochs_cap + 1):
        t0         = time.time()
        train_loss = train_one_epoch(model, train_loader, optimizer, criterion,
                                     device, scaler, GRAD_ACCUM)
        val_loss, val_labels, val_probs = eval_one_epoch(model, val_loader, criterion, device)

        from sklearn.metrics import roc_auc_score
        try:
            val_auc = float(roc_auc_score(val_labels, val_probs))
        except ValueError:
            val_auc = float("nan")

        epoch_time  = time.time() - t0
        total_time  = time.time() - t_start
        auc_str = f"{val_auc:.4f}" if val_auc == val_auc else "nan"
        log(f"  Epoch {epoch:03d}/{epochs_cap}  "
            f"train_loss={train_loss:.4f}  val_loss={val_loss:.4f}  "
            f"val_auc={auc_str}  ({epoch_time:.0f}s)")

        record = {
            "epoch":          epoch,
            "train_loss":     round(train_loss, 6),
            "val_loss":       round(val_loss,   6),
            "val_auc":        round(val_auc, 6) if val_auc == val_auc else None,
            "epoch_time_sec": round(epoch_time, 1),
        }
        training_log.append(record)

        if smoke_test and epoch == 1:
            projected = epoch_time * EPOCHS_MAX
            log(f"\n  ── SMOKE TEST RESULT ──")
            log(f"  1 epoch time:         {epoch_time:.1f} s")
            log(f"  Projected full time:  {projected/60:.1f} min ({EPOCHS_MAX} epochs, no early stopping)")
            log(f"  With patience={PATIENCE} early stopping, actual time will be much less.")
            log(f"  Pipeline: GPU={device.type=='cuda'}, AMP=True, batch={BATCH_SIZE}×accum{GRAD_ACCUM}")
            break

        # Save best model (val AUC)
        if val_auc == val_auc and val_auc > best_val_auc:
            best_val_auc     = val_auc
            patience_counter = 0
            import torch as _t
            _t.save({
                "epoch":              epoch,
                "model_state_dict":   model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_loss":           val_loss,
                "val_auc":            val_auc,
                "hyperparameters": {
                    "img_size":    IMG_SIZE,
                    "batch_size":  BATCH_SIZE,
                    "grad_accum":  GRAD_ACCUM,
                    "lr":          LR,
                    "lr_feature":  LR_FEATURE,
                    "seed":        SEED,
                    "augmentation": "rotation10, jitter, NO horizontal flip",
                },
            }, MODEL_PATH)
            log(f"    ✓ Best model saved  val_auc={val_auc:.4f}  → {MODEL_PATH}")
        else:
            patience_counter += 1
            log(f"    patience {patience_counter}/{PATIENCE}")
            if patience_counter >= PATIENCE:
                log(f"  Early stopping triggered at epoch {epoch}")
                break

        if total_time >= HARD_CAP_SEC:
            log(f"  Hard 60-minute cap reached. Stopping.")
            break

    total_time = time.time() - t_start
    if not smoke_test:
        log(f"\n  Training complete.  Total time: {total_time/60:.1f} min")
        log(f"  Best val_auc: {best_val_auc:.4f}")
        log(f"  Weights saved: {MODEL_PATH}")
        with open(LOG_PATH, "w") as f:
            json.dump(training_log, f, indent=2)

    # Save model card
    if not smoke_test and training_log:
        _save_model_card(training_log)

    return best_val_auc, training_log


def _save_model_card(training_log: list) -> None:
    best = max((r for r in training_log if r.get("val_auc")), key=lambda r: r["val_auc"])
    card = {
        "model_name":        "DenseNet121-TB-PulmoSure",
        "architecture":      "DenseNet121",
        "pretrained_weights": "ImageNet (torchvision DenseNet121_Weights.IMAGENET1K_V1)",
        "task":              "Binary: TB vs Normal",
        "output":            "Sigmoid score in [0,1]. Score >= threshold → TB-consistent.",
        "score_note":        "NOT a calibrated probability. Cannot confirm or rule out TB.",
        "input":             {"size": f"{IMG_SIZE}x{IMG_SIZE}", "channels": "RGB",
                              "mean": MEAN, "std": STD},
        "training": {
            "seed": SEED, "batch_size": BATCH_SIZE, "grad_accum": GRAD_ACCUM,
            "lr_classifier": LR, "lr_backbone": LR_FEATURE,
            "epochs_run": len(training_log), "patience": PATIENCE,
            "augmentation": "rotation±10°, brightness/contrast jitter ±20%, no horizontal flip",
            "amp": True, "optimizer": "AdamW",
        },
        "best_epoch": best,
        "dataset_sources": [
            "NLM Shenzhen (via raddar/tuberculosis-chest-xrays-shenzhen on Kaggle)",
            "Kaggle tawsifurrahman/tuberculosis-tb-chest-xray-dataset",
        ],
        "external_test_set": "NLM Montgomery (raddar/tuberculosis-chest-xrays-montgomery) — NEVER used in training or validation",
        "limitations": [
            "Small public research datasets (~hundreds of images per class).",
            "Not clinically validated.",
            "Score is not calibrated.",
            "Cross-dataset shift expected on external data.",
            "Research prototype only — not a medical device.",
        ],
        "weights_path": str(MODEL_PATH),
    }
    with open(CARD_PATH, "w") as f:
        json.dump(card, f, indent=2)
    log(f"  Model card saved: {CARD_PATH}")


# ══════════════════════════════════════════════════════════════════════════
# STEP 7  EVALUATION
# ══════════════════════════════════════════════════════════════════════════

def run_evaluation(split_df: pd.DataFrame) -> dict:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader

    log("=" * 60)
    log("STEP 7: EVALUATION (threshold on val, test on Montgomery)")
    log("=" * 60)

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}\n"
                                "Run --train first.")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model  = build_model()
    ckpt   = torch.load(MODEL_PATH, map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    model.to(device)
    log(f"  Loaded weights — epoch={ckpt.get('epoch', '?')}  val_auc={ckpt.get('val_auc', '?')}")

    val_rows  = split_df[split_df["split"] == "val"].to_dict("records")
    test_rows = split_df[split_df["split"] == "test"].to_dict("records")
    log(f"  Val set: {len(val_rows)}  |  Test set (Montgomery): {len(test_rows)}")

    transform = get_transforms(False)
    criterion = nn.BCEWithLogitsLoss()

    def get_probs(rows):
        ds     = TBDataset(rows, transform=transform)
        loader = DataLoader(ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
        _, labels, probs = eval_one_epoch(model, loader, criterion, device)
        return labels, probs

    # ── Validation inference + threshold selection ─────────────────────────
    log("  Running inference on validation set …")
    val_labels, val_probs = get_probs(val_rows)

    threshold = select_threshold(val_labels, val_probs, MIN_SENS)
    val_metrics = compute_metrics(val_labels, val_probs, threshold)
    val_metrics["split"] = "validation"

    log(f"\n  VALIDATION METRICS (threshold={threshold:.4f}):")
    for k, v in val_metrics.items():
        log(f"    {k}: {v}")

    # ── Montgomery test set — FROZEN threshold ─────────────────────────────
    log("\n  Running inference on Montgomery external test set …")
    test_labels, test_probs = get_probs(test_rows)
    test_metrics = compute_metrics(test_labels, test_probs, threshold)
    test_metrics["split"] = "montgomery_external_test"

    log(f"\n  MONTGOMERY TEST METRICS (threshold={threshold:.4f} — frozen from validation):")
    for k, v in test_metrics.items():
        log(f"    {k}: {v}")

    # ── Cross-dataset shift assessment ────────────────────────────────────
    val_auc  = val_metrics["roc_auc"] or 0.0
    test_auc = test_metrics["roc_auc"] or 0.0
    if test_auc < val_auc - 0.05:
        shift_note = (
            f"Montgomery AUC ({test_auc:.4f}) is {val_auc - test_auc:.4f} below "
            f"validation AUC ({val_auc:.4f}). This is expected cross-dataset "
            "distribution shift: Montgomery images come from a different scanner, "
            "site, and patient population. The threshold was NOT re-tuned on "
            "Montgomery — doing so would artificially inflate reported performance."
        )
    else:
        shift_note = (
            f"Montgomery AUC ({test_auc:.4f}) is within 0.05 of validation AUC "
            f"({val_auc:.4f}). No significant cross-dataset degradation observed."
        )
    log(f"\n  Cross-dataset note: {shift_note}")

    report = {
        "threshold_rule":     f"Lowest threshold on validation set achieving sensitivity ≥ {MIN_SENS:.0%}",
        "threshold_frozen_at": threshold,
        "validation":          val_metrics,
        "montgomery_external_test": test_metrics,
        "cross_dataset_note":  shift_note,
    }

    with open(METRICS_PATH, "w") as f:
        json.dump(report, f, indent=2)
    log(f"\n  JSON metrics saved: {METRICS_PATH}")

    _write_markdown_report(report, val_metrics, test_metrics, threshold, shift_note)
    log(f"  Markdown report saved: {REPORT_PATH}")

    return report


def _write_markdown_report(report, vm, tm, threshold, shift_note):
    cm_v = vm["confusion_matrix"]
    cm_t = tm["confusion_matrix"]

    md = f"""# PulmoSure DenseNet121 — Evaluation Report

## Threshold Selection

- **Rule**: pick the lowest threshold on the **validation set only** that achieves sensitivity ≥ {MIN_SENS:.0%}
- **Frozen threshold**: `{threshold:.4f}` — applied unchanged to Montgomery test set

---

## Validation Set Metrics

| Metric | Value |
|--------|-------|
| Samples | {vm['n_samples']} ({vm['n_TB']} TB, {vm['n_Normal']} Normal) |
| Accuracy | {vm['accuracy']:.4f} |
| Sensitivity | {vm['sensitivity']:.4f} |
| Specificity | {vm['specificity']:.4f} |
| Precision | {vm['precision']:.4f} |
| F1 | {vm['f1']:.4f} |
| ROC-AUC | {vm['roc_auc']:.4f} |

**Confusion Matrix** (rows = true label, cols = predicted label):

| | Pred Normal | Pred TB |
|--|--|--|
| **True Normal** | {cm_v[0][0]} | {cm_v[0][1]} |
| **True TB** | {cm_v[1][0]} | {cm_v[1][1]} |

---

## Montgomery External Test Set Metrics

| Metric | Value |
|--------|-------|
| Samples | {tm['n_samples']} ({tm['n_TB']} TB, {tm['n_Normal']} Normal) |
| Accuracy | {tm['accuracy']:.4f} |
| Sensitivity | {tm['sensitivity']:.4f} |
| Specificity | {tm['specificity']:.4f} |
| Precision | {tm['precision']:.4f} |
| F1 | {tm['f1']:.4f} |
| ROC-AUC | {tm['roc_auc']:.4f} |

**Confusion Matrix**:

| | Pred Normal | Pred TB |
|--|--|--|
| **True Normal** | {cm_t[0][0]} | {cm_t[0][1]} |
| **True TB** | {cm_t[1][0]} | {cm_t[1][1]} |

---

## Cross-Dataset Shift

{shift_note}

---

## Limitations

- Trained on small public research datasets (hundreds of images).
- **Not clinically validated.** For research and demonstration only.
- Model score is NOT a calibrated probability.
- Cross-dataset performance degradation is expected and honest.
- This is a research prototype — not a medical device.
"""
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(md)


# ══════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="PulmoSure Full Training Pipeline (Steps 3–7)")
    parser.add_argument("--manifest-only", action="store_true",
                        help="Step 3+4: build manifest, deduplicate, split, cache")
    parser.add_argument("--smoke-test",    action="store_true",
                        help="Step 5: 1-epoch smoke test (~100 images), prints time estimate")
    parser.add_argument("--train",         action="store_true",
                        help="Step 6: full DenseNet121 training")
    parser.add_argument("--eval",          action="store_true",
                        help="Step 7: evaluate, select threshold on val, report on Montgomery")
    parser.add_argument("--rebuild",       action="store_true",
                        help="Force rebuild of manifest even if cached")
    args = parser.parse_args()

    if not any([args.manifest_only, args.smoke_test, args.train, args.eval]):
        parser.print_help()
        return

    manifest_csv = PROCESSED / "manifest_v2.csv"
    stats_json   = PROCESSED / "dataset_stats.json"

    # Load or build manifest
    if manifest_csv.exists() and not args.rebuild:
        log(f"Loading cached manifest from {manifest_csv}")
        df = pd.read_csv(manifest_csv)
        # Verify cached image paths still exist; rebuild if stale
        sample_missing = sum(1 for p in df["path"].head(10) if not Path(p).exists())
        if sample_missing > 5:
            log("Manifest paths appear stale — rebuilding …")
            args.rebuild = True

    if not manifest_csv.exists() or args.rebuild:
        df, stats = build_manifest()
        df = make_splits(df)
        df = pre_resize_cache(df)
        df.to_csv(manifest_csv, index=False)
        with open(stats_json, "w") as f:
            json.dump(stats, f, indent=2)
        df[df["split"] == "train"].to_csv(PROCESSED / "train.csv", index=False)
        df[df["split"] == "val"].to_csv(PROCESSED / "val.csv",   index=False)
        df[df["split"] == "test"].to_csv(PROCESSED / "test.csv",  index=False)
        log(f"\nManifest saved: {manifest_csv}")

    if args.manifest_only:
        log("\nStep 3+4 complete. Run --smoke-test next.")
        return

    if args.smoke_test:
        run_training(df, smoke_test=True)

    if args.train:
        run_training(df, smoke_test=False)

    if args.eval:
        run_evaluation(df)
        log("\nAll steps complete.")
        log(f"  Weights:  {MODEL_PATH}")
        log(f"  Metrics:  {METRICS_PATH}")
        log(f"  Report:   {REPORT_PATH}")


if __name__ == "__main__":
    main()
