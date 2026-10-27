"""
PulmoSure AI — Dataset Download Script
=======================================
Downloads TB chest X-ray datasets via Kaggle API (NLM server returns HTTP 403
on direct download as of Oct 2026, so Kaggle mirrors are the primary source).

Datasets downloaded:
  1. raddar/tuberculosis-chest-xrays-shenzhen
       → Shenzhen NLM images (use for TRAINING + VALIDATION)
  2. raddar/tuberculosis-chest-xrays-montgomery
       → Montgomery NLM images (EXTERNAL TEST SET ONLY — never trained on)
  3. tawsifurrahman/tuberculosis-tb-chest-xray-dataset
       → Additional TB / Normal CXR images (TRAINING + VALIDATION)

Requirements:
    kaggle.json at:  C:\\Users\\<you>\\.kaggle\\kaggle.json
    (Get from: https://www.kaggle.com/settings → API → Create New Token)

Run:
    python data/download_datasets.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

# ── Directory layout ──────────────────────────────────────────────────────
ROOT           = Path(__file__).parent
RAW            = ROOT / "raw"
SHENZHEN_DIR   = RAW / "shenzhen"
MONTGOMERY_DIR = RAW / "montgomery"
KAGGLE_TB_DIR  = RAW / "kaggle_tb"

for d in (SHENZHEN_DIR, MONTGOMERY_DIR, KAGGLE_TB_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ── Kaggle dataset slugs ──────────────────────────────────────────────────
KAGGLE_SHENZHEN   = "raddar/tuberculosis-chest-xrays-shenzhen"
KAGGLE_MONTGOMERY = "raddar/tuberculosis-chest-xrays-montgomery"
KAGGLE_TB_EXTRA   = "tawsifurrahman/tuberculosis-tb-chest-xray-dataset"


def log(msg: str) -> None:
    print(f"[download] {msg}", flush=True)


def count_images(directory: Path) -> int:
    return sum(
        1 for _ in directory.rglob("*")
        if _.suffix.lower() in {".png", ".jpg", ".jpeg"}
    )


def verify_kaggle_credentials() -> bool:
    kaggle_json = Path.home() / ".kaggle" / "kaggle.json"
    if not kaggle_json.exists():
        log("=" * 60)
        log("KAGGLE CREDENTIALS MISSING")
        log("=" * 60)
        log(f"Place your kaggle.json at:  {kaggle_json}")
        log("Get it from: https://www.kaggle.com/settings")
        log("  → API section → 'Create New Token'")
        log("The file should contain:  {\"username\":\"...\",\"key\":\"...\"}")
        log("=" * 60)
        return False

    # Verify permissions (Kaggle requires 600 on Linux; on Windows just check it's readable)
    try:
        import json as _json
        with open(kaggle_json) as f:
            creds = _json.load(f)
        if "username" not in creds or "key" not in creds:
            log(f"ERROR: kaggle.json at {kaggle_json} is missing 'username' or 'key' fields.")
            return False
        log(f"Kaggle credentials found for user: {creds['username']}")
        return True
    except Exception as e:
        log(f"ERROR reading kaggle.json: {e}")
        return False


def kaggle_download(dataset_slug: str, dest_dir: Path, min_images: int) -> bool:
    """Download a Kaggle dataset. Returns True if successful or already present."""
    n = count_images(dest_dir)
    if n >= min_images:
        log(f"  Already present ({n} images in {dest_dir.name}) — skipping download")
        return True

    log(f"  Downloading Kaggle dataset: {dataset_slug} → {dest_dir}")
    result = subprocess.run(
        [
            sys.executable, "-m", "kaggle",
            "datasets", "download",
            "-d", dataset_slug,
            "-p", str(dest_dir),
            "--unzip",
        ],
        capture_output=False,  # show progress to user
        text=True,
    )
    if result.returncode != 0:
        log(f"  Kaggle download FAILED (exit code {result.returncode})")
        return False

    n_after = count_images(dest_dir)
    log(f"  Download complete: {n_after} images in {dest_dir}")
    return n_after > 0


def verify_all_decodable(directory: Path, sample: int = 30) -> int:
    """Return count of verified-decodable images (from a sample)."""
    from PIL import Image, UnidentifiedImageError
    paths = [
        p for p in directory.rglob("*")
        if p.suffix.lower() in {".png", ".jpg", ".jpeg"}
    ][:sample]
    ok = 0
    for p in paths:
        try:
            with Image.open(p) as img:
                img.load()
            ok += 1
        except (UnidentifiedImageError, OSError) as e:
            log(f"  CORRUPT: {p.name} — {e}")
    return ok


def main() -> None:
    log("=" * 60)
    log("PulmoSure AI — Dataset Download (Kaggle sources)")
    log("=" * 60)

    if not verify_kaggle_credentials():
        sys.exit(1)

    results: dict[str, bool] = {}

    # ── 1. Shenzhen (NLM mirror on Kaggle) ───────────────────────────────
    log("\n--- Shenzhen Hospital CXR Set (via raddar/tuberculosis-chest-xrays-shenzhen) ---")
    log("  Role: TRAINING + VALIDATION")
    ok = kaggle_download(KAGGLE_SHENZHEN, SHENZHEN_DIR, min_images=300)
    results["shenzhen"] = ok
    if ok:
        n = count_images(SHENZHEN_DIR)
        log(f"  Shenzhen total images: {n}")
        verified = verify_all_decodable(SHENZHEN_DIR)
        log(f"  Decode check (sample 30): {verified}/30 OK")

    # ── 2. Montgomery (NLM mirror on Kaggle) ─────────────────────────────
    log("\n--- Montgomery County CXR Set (via raddar/tuberculosis-chest-xrays-montgomery) ---")
    log("  Role: EXTERNAL TEST SET ONLY — will never be used for training or validation")
    ok = kaggle_download(KAGGLE_MONTGOMERY, MONTGOMERY_DIR, min_images=100)
    results["montgomery"] = ok
    if ok:
        n = count_images(MONTGOMERY_DIR)
        log(f"  Montgomery total images: {n}")
        verified = verify_all_decodable(MONTGOMERY_DIR)
        log(f"  Decode check (sample 30): {verified}/30 OK")

    # ── 3. Kaggle TB dataset (tawsifurrahman) ────────────────────────────
    log("\n--- Kaggle TB Chest X-ray Dataset (tawsifurrahman) ---")
    log("  Role: TRAINING + VALIDATION (with cross-dataset dedup against Montgomery)")
    ok = kaggle_download(KAGGLE_TB_EXTRA, KAGGLE_TB_DIR, min_images=100)
    results["kaggle_tb"] = ok
    if ok:
        n = count_images(KAGGLE_TB_DIR)
        log(f"  Kaggle TB total images: {n}")

    # ── Summary ───────────────────────────────────────────────────────────
    log("\n--- Download Summary ---")
    log(f"  Shenzhen:   {'OK' if results.get('shenzhen') else 'FAILED'} ({count_images(SHENZHEN_DIR)} images)")
    log(f"  Montgomery: {'OK' if results.get('montgomery') else 'FAILED'} ({count_images(MONTGOMERY_DIR)} images)")
    log(f"  Kaggle TB:  {'OK' if results.get('kaggle_tb') else 'FAILED'} ({count_images(KAGGLE_TB_DIR)} images)")

    if not any(results.values()):
        log("\nERROR: No datasets downloaded successfully.")
        sys.exit(1)
    elif not results.get("shenzhen") and not results.get("kaggle_tb"):
        log("\nWARNING: No training data available. Need at least Shenzhen or Kaggle TB.")
        sys.exit(1)
    else:
        log("\nDownload complete. Next step:")
        log("  python data/full_pipeline.py --manifest-only   # Step 3+4: manifest+split")
        log("  python data/full_pipeline.py --smoke-test      # Step 5: smoke test")
        log("  python data/full_pipeline.py --train --eval    # Step 6+7: train + evaluate")


if __name__ == "__main__":
    main()
