"""
PulmoSure AI — Master Run Script (Steps 2–8 fully automatic)
=============================================================
Run this ONCE. It does everything:
  1. Downloads datasets (Kaggle TB + Montgomery)
  2. Builds manifest, deduplicates, splits 85/15
  3. Pre-resizes images to 224x224 cache
  4. Smoke test (estimates training time)
  5. Full DenseNet121 training (GPU/CPU, AMP, class weights)
  6. Evaluates, selects threshold on validation
  7. Updates backend/.env with model path + threshold
  8. Prints final report

Usage:
    python data/run_all.py

Requires: kaggle.json at C:/Users/<you>/.kaggle/kaggle.json
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT      = Path(__file__).parent
BACKEND   = ROOT.parent / "backend"
ARTIFACTS = ROOT.parent / "model_artifacts"
PROCESSED = ROOT / "processed"
ENV_FILE  = BACKEND / ".env"

PYTHON = sys.executable  # use the current venv python


def run(cmd: list, label: str) -> int:
    print(f"\n{'='*60}\n[run_all] {label}\n{'='*60}", flush=True)
    t0 = time.time()
    result = subprocess.run(cmd)
    elapsed = time.time() - t0
    ok = result.returncode == 0
    print(f"[run_all] {label} -> {'OK' if ok else 'FAILED'}  ({elapsed/60:.1f} min)", flush=True)
    return result.returncode


def count_images(d: Path) -> int:
    return sum(1 for p in d.rglob("*") if p.suffix.lower() in {".png", ".jpg", ".jpeg"})


def update_env(key: str, value: str) -> None:
    """Update or add a key=value line in backend/.env"""
    lines = ENV_FILE.read_text(encoding="utf-8").splitlines()
    new_lines = []
    found = False
    for line in lines:
        if line.startswith(f"{key}=") or line.startswith(f"{key} ="):
            new_lines.append(f"{key}={value}")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f"{key}={value}")
    ENV_FILE.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    print(f"[run_all] .env updated: {key}={value}", flush=True)


def main():
    print("=" * 60)
    print("PulmoSure AI — Full Automated Run")
    print("=" * 60)

    # ── STEP 2: Download datasets ──────────────────────────────────
    print("\n[STEP 2] Downloading datasets...")
    for slug, dest_name, min_imgs in [
        ("tawsifurrahman/tuberculosis-tb-chest-xray-dataset", "kaggle_tb", 100),
        ("raddar/tuberculosis-chest-xrays-montgomery",        "montgomery", 50),
    ]:
        dest = ROOT / "raw" / dest_name
        dest.mkdir(parents=True, exist_ok=True)
        n = count_images(dest)
        if n >= min_imgs:
            print(f"  {dest_name}: {n} images already present — skip", flush=True)
            continue
        print(f"  Downloading {slug} -> {dest}", flush=True)
        rc = run(
            [PYTHON, "-m", "kaggle", "datasets", "download",
             "-d", slug, "-p", str(dest), "--unzip"],
            f"Download {dest_name}"
        )
        if rc != 0:
            print(f"  ERROR: Download of {slug} failed. Check kaggle.json.", flush=True)
            if dest_name == "kaggle_tb":
                sys.exit(1)  # training data is required
            # Montgomery failure: warn but continue (can still train without test set)
            print("  WARNING: Montgomery missing — no external test evaluation.", flush=True)

    # Verify
    n_kaggle = count_images(ROOT / "raw" / "kaggle_tb")
    n_mont   = count_images(ROOT / "raw" / "montgomery")
    print(f"\n  Kaggle TB images:  {n_kaggle}")
    print(f"  Montgomery images: {n_mont}")
    if n_kaggle == 0:
        print("ERROR: No training images found. Cannot continue.")
        sys.exit(1)

    # ── STEPS 3–4: Manifest + split + cache ───────────────────────
    manifest_csv = PROCESSED / "manifest_v2.csv"
    if manifest_csv.exists():
        print(f"\n[STEPS 3–4] Manifest already exists at {manifest_csv} — skipping rebuild.")
        print("  (Delete it and re-run to force rebuild)")
    else:
        rc = run([PYTHON, str(ROOT / "full_pipeline.py"), "--manifest-only"],
                 "Steps 3+4: Manifest + split + 224×224 cache")
        if rc != 0:
            print("ERROR: Manifest step failed.")
            sys.exit(1)

    # ── STEP 5: Smoke test ────────────────────────────────────────
    rc = run([PYTHON, str(ROOT / "full_pipeline.py"), "--smoke-test"],
             "Step 5: Smoke test (1 epoch × 100 images)")
    # smoke test failure is non-fatal — just warn
    if rc != 0:
        print("  WARNING: Smoke test had errors. Continuing to full training anyway.")

    # ── STEP 6: Full training ─────────────────────────────────────
    model_path = ARTIFACTS / "densenet121_tb_best.pth"
    rc = run([PYTHON, str(ROOT / "full_pipeline.py"), "--train"],
             "Step 6: Full DenseNet121 training")
    if rc != 0 or not model_path.exists():
        print("ERROR: Training failed or weights not saved.")
        sys.exit(1)
    print(f"  Weights saved: {model_path}")

    # ── STEP 7: Evaluate ──────────────────────────────────────────
    rc = run([PYTHON, str(ROOT / "full_pipeline.py"), "--eval"],
             "Step 7: Evaluate — threshold on val, test on Montgomery")
    metrics_path = ARTIFACTS / "metrics_report.json"
    if rc != 0 or not metrics_path.exists():
        print("WARNING: Evaluation step failed or metrics not saved. Using threshold=0.5.")
        threshold = 0.5
    else:
        with open(metrics_path) as f:
            metrics = json.load(f)
        threshold = metrics.get("threshold_frozen_at", 0.5)
        print(f"\n  Validation metrics:")
        vm = metrics.get("validation", {})
        for k in ["accuracy", "sensitivity", "specificity", "precision", "f1", "roc_auc"]:
            print(f"    {k}: {vm.get(k, 'N/A')}")
        print(f"\n  Montgomery (external test) metrics:")
        tm = metrics.get("montgomery_external_test", {})
        for k in ["accuracy", "sensitivity", "specificity", "precision", "f1", "roc_auc"]:
            print(f"    {k}: {tm.get(k, 'N/A')}")
        print(f"\n  Frozen threshold: {threshold}")

    # ── STEP 8: Update backend .env ───────────────────────────────
    print("\n[STEP 8] Updating backend/.env ...")
    update_env("MODEL_WEIGHTS_PATH", str(model_path.resolve()))
    update_env("MODEL_THRESHOLD",    str(round(threshold, 6)))
    print(f"  MODEL_WEIGHTS_PATH={model_path.resolve()}")
    print(f"  MODEL_THRESHOLD={threshold}")

    # ── Final summary ─────────────────────────────────────────────
    print("\n" + "="*60)
    print("ALL STEPS COMPLETE")
    print("="*60)
    print(f"  Weights:   {model_path}")
    print(f"  Threshold: {threshold}")
    print(f"  Metrics:   {metrics_path}")
    print(f"  Report:    {ARTIFACTS / 'evaluation_report.md'}")
    print(f"\nTo start backend with model loaded:")
    print(f"  cd backend")
    print(f"  .venv\\Scripts\\uvicorn app.main:app --reload --port 8000")
    print(f"\nTo run end-to-end test (backend must be running):")
    print(f"  python data/e2e_test.py")


if __name__ == "__main__":
    main()
