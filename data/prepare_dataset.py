"""
SwasthyaScan AI — Dataset Preparation Script
============================================
Builds a unified manifest from downloaded datasets, deduplicates images,
and creates reproducible train/validation splits.

Dataset roles (as per project spec):
  - Shenzhen:   Training + Validation (primary training data)
  - Kaggle TB:  Training + Validation (if downloaded and approved)
  - Montgomery: External TEST SET ONLY — never mixed into training/validation

Run from project root:
    python data/prepare_dataset.py

Outputs:
  data/processed/manifest.csv         — full dataset with source, label, split
  data/processed/train.csv
  data/processed/val.csv
  data/processed/test.csv             — Montgomery only

Label conventions:
  1 = TB-positive (abnormal)
  0 = Normal
  
IMPORTANT: Labels come from source metadata only.
  - Shenzhen: filename encodes label (0=normal, 1=TB) per NLM documentation.
  - Montgomery: filename encodes label (0=normal, 1=TB) per NLM documentation.
  - Kaggle tawsifurrahman: folder name is 'Normal' or 'Tuberculosis'.
  
We do NOT treat 'abnormal' as equivalent to 'TB' or relabel any output.
"""

from __future__ import annotations

import hashlib
import json
import random
import re
from pathlib import Path

import pandas as pd
from PIL import Image, UnidentifiedImageError

# ── Paths ────────────────────────────────────────────────────────────────
ROOT      = Path(__file__).parent
RAW       = ROOT / "raw"
PROCESSED = ROOT / "processed"
PROCESSED.mkdir(exist_ok=True)

SHENZHEN_DIR   = RAW / "shenzhen"
MONTGOMERY_DIR = RAW / "montgomery"
KAGGLE_TB_DIR  = RAW / "kaggle_tb"

RANDOM_SEED  = 42
TRAIN_RATIO  = 0.80
VAL_RATIO    = 0.20
# Montgomery is always test-only — never trained on.


def log(msg: str) -> None:
    print(f"[prepare] {msg}", flush=True)


def file_hash(path: Path, chunk: int = 65536) -> str:
    """MD5 of file bytes — used for exact-duplicate detection."""
    h = hashlib.md5()
    with open(path, "rb") as f:
        while blk := f.read(chunk):
            h.update(blk)
    return h.hexdigest()


def image_ok(path: Path) -> bool:
    """Return True if Pillow can fully decode the image."""
    try:
        with Image.open(path) as img:
            img.load()
        return True
    except (UnidentifiedImageError, OSError):
        return False


# ── Label extraction ─────────────────────────────────────────────────────
def shenzhen_label(filename: str) -> int | None:
    """
    NLM Shenzhen naming convention (documented):
      CHNCXR_XXXX_0.png → label 0 (Normal)
      CHNCXR_XXXX_1.png → label 1 (TB abnormal)
    The last digit before the extension is the label.
    """
    m = re.search(r"_(\d)\.png$", filename, re.IGNORECASE)
    if m:
        return int(m.group(1))
    return None


def montgomery_label(filename: str) -> int | None:
    """
    NLM Montgomery naming convention (documented):
      MCUCXR_XXXX_0.png → label 0 (Normal)
      MCUCXR_XXXX_1.png → label 1 (TB abnormal)
    """
    m = re.search(r"_(\d)\.png$", filename, re.IGNORECASE)
    if m:
        return int(m.group(1))
    return None


def kaggle_tb_label(path: Path) -> int | None:
    """
    Kaggle tawsifurrahman dataset folder structure:
      Tuberculosis/  → label 1
      Normal/        → label 0
    Match case-insensitively.
    """
    for part in path.parts:
        if part.lower() == "tuberculosis":
            return 1
        if part.lower() == "normal":
            return 0
    return None


# ── Dataset scanning ─────────────────────────────────────────────────────
def scan_shenzhen() -> list[dict]:
    records = []
    exts = {".png", ".jpg", ".jpeg"}
    for p in SHENZHEN_DIR.rglob("*"):
        if p.suffix.lower() not in exts:
            continue
        label = shenzhen_label(p.name)
        if label is None:
            log(f"  Cannot parse label from: {p.name} — skipping")
            continue
        records.append({
            "path":    str(p.resolve()),
            "source":  "shenzhen_nlm",
            "label":   label,
            "label_str": "TB" if label == 1 else "Normal",
            "filename": p.name,
            "split":   "train_val",  # will be assigned later
        })
    return records


def scan_montgomery() -> list[dict]:
    records = []
    exts = {".png", ".jpg", ".jpeg"}
    for p in MONTGOMERY_DIR.rglob("*"):
        if p.suffix.lower() not in exts:
            continue
        label = montgomery_label(p.name)
        if label is None:
            log(f"  Cannot parse label from: {p.name} — skipping")
            continue
        records.append({
            "path":    str(p.resolve()),
            "source":  "montgomery_nlm",
            "label":   label,
            "label_str": "TB" if label == 1 else "Normal",
            "filename": p.name,
            "split":   "test",  # ALWAYS test-only
        })
    return records


def scan_kaggle_tb() -> list[dict]:
    records = []
    exts = {".png", ".jpg", ".jpeg"}
    for p in KAGGLE_TB_DIR.rglob("*"):
        if p.suffix.lower() not in exts:
            continue
        label = kaggle_tb_label(p)
        if label is None:
            log(f"  Cannot parse label from: {p} — skipping")
            continue
        records.append({
            "path":    str(p.resolve()),
            "source":  "kaggle_tawsifurrahman",
            "label":   label,
            "label_str": "TB" if label == 1 else "Normal",
            "filename": p.name,
            "split":   "train_val",
        })
    return records


# ── Duplicate removal ─────────────────────────────────────────────────────
def deduplicate(records: list[dict]) -> list[dict]:
    """Remove exact duplicates (same MD5 hash). Keep first occurrence."""
    log("Computing image hashes for deduplication …")
    seen: dict[str, str] = {}  # hash → path
    unique = []
    duplicates = 0
    for i, rec in enumerate(records):
        if i % 200 == 0:
            print(f"\r  Processed {i}/{len(records)} …", end="", flush=True)
        try:
            h = file_hash(Path(rec["path"]))
        except OSError as e:
            log(f"  Cannot hash {rec['filename']}: {e} — skipping")
            continue
        if h in seen:
            duplicates += 1
            log(f"\n  DUPLICATE: {rec['filename']} == {Path(seen[h]).name}")
        else:
            seen[h] = rec["path"]
            rec["md5"] = h
            unique.append(rec)
    print()
    log(f"  Duplicates removed: {duplicates}; Unique: {len(unique)}")
    return unique


# ── Image decodability check ──────────────────────────────────────────────
def filter_decodable(records: list[dict]) -> list[dict]:
    log("Verifying all images are decodable …")
    ok = []
    bad = 0
    for i, rec in enumerate(records):
        if i % 200 == 0:
            print(f"\r  Checked {i}/{len(records)} …", end="", flush=True)
        if image_ok(Path(rec["path"])):
            ok.append(rec)
        else:
            log(f"\n  CORRUPT: {rec['filename']}")
            bad += 1
    print()
    log(f"  Corrupt/undecodable: {bad}; Valid: {len(ok)}")
    return ok


# ── Train / val split (only for train_val records) ────────────────────────
def make_splits(records: list[dict]) -> list[dict]:
    """
    Stratified split preserving TB/Normal ratio.
    Montgomery records keep split='test' unchanged.
    """
    rng = random.Random(RANDOM_SEED)

    train_val = [r for r in records if r["split"] == "train_val"]
    test_only  = [r for r in records if r["split"] == "test"]

    # Group by label for stratified split
    by_label: dict[int, list[dict]] = {0: [], 1: []}
    for r in train_val:
        by_label[r["label"]].append(r)

    train, val = [], []
    for label, group in by_label.items():
        rng.shuffle(group)
        n_train = round(len(group) * TRAIN_RATIO)
        for r in group[:n_train]:
            r["split"] = "train"
            train.append(r)
        for r in group[n_train:]:
            r["split"] = "val"
            val.append(r)

    all_records = train + val + test_only
    log(f"Split: train={len(train)}, val={len(val)}, test(Montgomery)={len(test_only)}")
    return all_records


# ── Main ──────────────────────────────────────────────────────────────────
def main() -> None:
    log("=" * 60)
    log("SwasthyaScan AI — Dataset Preparation")
    log("=" * 60)

    all_records: list[dict] = []

    # Scan datasets
    log("\n--- Scanning Shenzhen ---")
    sz = scan_shenzhen()
    log(f"  Found {len(sz)} images (TB={sum(r['label'] for r in sz)}, Normal={sum(1-r['label'] for r in sz)})")
    all_records.extend(sz)

    log("\n--- Scanning Montgomery (test-only) ---")
    mg = scan_montgomery()
    log(f"  Found {len(mg)} images (TB={sum(r['label'] for r in mg)}, Normal={sum(1-r['label'] for r in mg)})")
    all_records.extend(mg)

    log("\n--- Scanning Kaggle TB dataset ---")
    kg = scan_kaggle_tb()
    log(f"  Found {len(kg)} images (TB={sum(r['label'] for r in kg)}, Normal={sum(1-r['label'] for r in kg)})")
    all_records.extend(kg)

    if not all_records:
        log("ERROR: No images found. Run download_datasets.py first.")
        return

    log(f"\nTotal before dedup: {len(all_records)}")

    # Deduplicate
    all_records = deduplicate(all_records)

    # Verify decodability
    all_records = filter_decodable(all_records)

    # Make splits
    log("\n--- Creating train/val/test splits ---")
    all_records = make_splits(all_records)

    # Save manifests
    df = pd.DataFrame(all_records)
    df.to_csv(PROCESSED / "manifest.csv", index=False)
    df[df["split"] == "train"].to_csv(PROCESSED / "train.csv", index=False)
    df[df["split"] == "val"].to_csv(PROCESSED / "val.csv", index=False)
    df[df["split"] == "test"].to_csv(PROCESSED / "test.csv", index=False)

    log(f"\n--- Final Statistics ---")
    log(f"  Train: {len(df[df['split']=='train'])} images")
    log(f"    TB:     {len(df[(df['split']=='train') & (df['label']==1)])}")
    log(f"    Normal: {len(df[(df['split']=='train') & (df['label']==0)])}")
    log(f"  Val:   {len(df[df['split']=='val'])} images")
    log(f"  Test:  {len(df[df['split']=='test'])} images (Montgomery, external only)")
    log(f"\n  Manifests saved to {PROCESSED}/")
    log("  Next step: python data/train_model.py")


if __name__ == "__main__":
    main()
