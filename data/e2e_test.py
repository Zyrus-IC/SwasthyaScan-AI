"""
PulmoSure AI — End-to-End API Test (Step 10)
=============================================
Tests the real screening API with images from the Montgomery test set.

Tests:
  - 3 TB images (from Montgomery test set)
  - 3 Normal images (from Montgomery test set)
  - 1 non-X-ray image (generated solid-colour PNG)
  - 1 corrupted file (random bytes)

Produces a table: file | true_label | model_probability | result_state | correct

Run AFTER backend is started:
    uvicorn app.main:app --reload --port 8000 (in backend/ dir)

Then:
    python data/e2e_test.py
"""

from __future__ import annotations

import io
import json
import os
import random
import sys
import time
from pathlib import Path

import requests
from PIL import Image

BACKEND_URL = "http://localhost:8000"
ANALYZE_URL = f"{BACKEND_URL}/api/screening/analyze"
HEALTH_URL  = f"{BACKEND_URL}/health"
ROOT        = Path(__file__).parent
PROCESSED   = ROOT / "processed"
ARTIFACTS   = ROOT.parent / "model_artifacts"


def log(msg: str) -> None:
    print(f"[e2e] {msg}", flush=True)


def check_backend() -> dict:
    """Check backend health and model status."""
    try:
        r = requests.get(HEALTH_URL, timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log(f"FATAL: Backend not reachable at {BACKEND_URL}: {e}")
        log("Start backend first: cd backend && .venv\\Scripts\\uvicorn app.main:app --port 8000")
        sys.exit(1)


def load_test_images(n_tb: int = 3, n_normal: int = 3) -> list[dict]:
    """Pick N TB and N Normal images from the Montgomery test set."""
    test_csv = PROCESSED / "test.csv"
    if not test_csv.exists():
        raise FileNotFoundError(f"test.csv not found at {test_csv}. Run the pipeline first.")
    
    import pandas as pd
    df = pd.read_csv(test_csv)
    df_tb     = df[df["label"] == 1].sample(min(n_tb,     len(df[df["label"] == 1])),     random_state=42)
    df_normal = df[df["label"] == 0].sample(min(n_normal, len(df[df["label"] == 0])), random_state=42)

    rows = []
    for _, r in df_tb.iterrows():
        rows.append({"path": r["path"], "true_label": "TB", "filename": Path(r["path"]).name})
    for _, r in df_normal.iterrows():
        rows.append({"path": r["path"], "true_label": "Normal", "filename": Path(r["path"]).name})
    return rows


def make_non_xray() -> bytes:
    """A solid red 224×224 PNG — clearly not an X-ray."""
    img = Image.new("RGB", (224, 224), (220, 60, 60))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def make_corrupted() -> bytes:
    """Random bytes — not a valid image."""
    rng = random.Random(42)
    return bytes(rng.randint(0, 255) for _ in range(2048))


def call_api(image_bytes: bytes, filename: str, content_type: str = "image/png") -> dict:
    """POST to /api/screening/analyze and return parsed JSON response."""
    try:
        r = requests.post(
            ANALYZE_URL,
            files={"image": (filename, image_bytes, content_type)},
            data={"symptoms": "{}"},
            timeout=60,
        )
        return {"http_status": r.status_code, "body": r.json() if r.status_code != 422 else {"detail": r.text}}
    except Exception as e:
        return {"http_status": -1, "body": {"detail": str(e)}}


def run_e2e_test() -> None:
    log("=" * 60)
    log("PulmoSure AI — End-to-End API Test (Step 10)")
    log("=" * 60)

    # 1. Backend health check
    health = check_backend()
    log(f"Backend: {health.get('status', '?')}  model_loaded={health.get('model_loaded', '?')}")
    if not health.get("model_loaded"):
        log("WARNING: Model not loaded. Results will all be 'unavailable'.")
        log("  → Set MODEL_WEIGHTS_PATH in backend/.env and restart backend.")

    # 2. Load Montgomery test images
    test_rows = load_test_images(n_tb=3, n_normal=3)
    log(f"Test images: {len(test_rows)} from Montgomery ({sum(1 for r in test_rows if r['true_label']=='TB')} TB, "
        f"{sum(1 for r in test_rows if r['true_label']=='Normal')} Normal)")

    results = []

    # 3. Real X-rays
    for row in test_rows:
        log(f"  Testing: {row['filename']} (true={row['true_label']}) …")
        with open(row["path"], "rb") as f:
            img_bytes = f.read()
        ext = Path(row["path"]).suffix.lower()
        ctype = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
        resp = call_api(img_bytes, row["filename"], ctype)

        body = resp["body"]
        model_score  = body.get("model_output", {}).get("score") if body.get("model_output") else None
        model_pred   = body.get("model_output", {}).get("prediction") if body.get("model_output") else None
        result_state = body.get("status", "error")

        # Correctness: if model ran, check prediction matches true label
        if model_score is not None and model_pred is not None:
            correct = (model_pred == row["true_label"])
            correct_str = "✓" if correct else "✗"
        else:
            correct_str = "— (model unavailable)"

        results.append({
            "file":            row["filename"],
            "true_label":      row["true_label"],
            "model_score":     f"{model_score:.3f}" if model_score is not None else "N/A",
            "model_pred":      model_pred or "N/A",
            "result_state":    result_state,
            "http_status":     resp["http_status"],
            "correct":         correct_str,
        })

    # 4. Non-X-ray (solid red image)
    log("  Testing: non_xray.png (solid red image) …")
    resp = call_api(make_non_xray(), "non_xray_test.png", "image/png")
    body = resp["body"]
    model_score = body.get("model_output", {}).get("score") if body.get("model_output") else None
    results.append({
        "file":         "non_xray_test.png",
        "true_label":   "Non-X-ray",
        "model_score":  f"{model_score:.3f}" if model_score is not None else "N/A",
        "model_pred":   body.get("model_output", {}).get("prediction", "N/A") if body.get("model_output") else "N/A",
        "result_state": body.get("status", f"HTTP {resp['http_status']}"),
        "http_status":  resp["http_status"],
        "correct":      "— (no ground truth; API should not crash)",
    })

    # 5. Corrupted file
    log("  Testing: corrupted.png (random bytes) …")
    resp = call_api(make_corrupted(), "corrupted_test.png", "image/png")
    body = resp["body"]
    handled = resp["http_status"] in (200, 422, 400)  # any structured response is fine
    results.append({
        "file":         "corrupted_test.png",
        "true_label":   "Corrupted",
        "model_score":  "N/A",
        "model_pred":   "N/A",
        "result_state": body.get("status", f"HTTP {resp['http_status']}"),
        "http_status":  resp["http_status"],
        "correct":      "✓ (gracefully rejected)" if handled else "✗ (unexpected error)",
    })

    # 6. Print table
    log("\n" + "=" * 100)
    log("END-TO-END TEST RESULTS")
    log("=" * 100)
    header = f"{'File':<35} {'True':>8} {'Score':>7} {'Pred':>8} {'State':<22} {'HTTP':>5} {'OK?':>10}"
    log(header)
    log("-" * 100)
    for r in results:
        row_str = (
            f"{r['file']:<35} {r['true_label']:>8} {r['model_score']:>7} "
            f"{r['model_pred']:>8} {r['result_state']:<22} {r['http_status']:>5} {r['correct']:>10}"
        )
        log(row_str)
    log("=" * 100)

    # 7. Save results
    out = ARTIFACTS / "e2e_test_results.json"
    with open(out, "w") as f:
        json.dump(results, f, indent=2)
    log(f"\nResults saved to: {out}")

    # Summary
    tb_results = [r for r in results if r["true_label"] == "TB"]
    normal_results = [r for r in results if r["true_label"] == "Normal"]
    tb_correct = sum(1 for r in tb_results if "✓" in str(r["correct"]))
    normal_correct = sum(1 for r in normal_results if "✓" in str(r["correct"]))
    log(f"\nSummary (model-ran cases only):")
    log(f"  TB:     {tb_correct}/{len(tb_results)} correct")
    log(f"  Normal: {normal_correct}/{len(normal_results)} correct")


if __name__ == "__main__":
    run_e2e_test()
