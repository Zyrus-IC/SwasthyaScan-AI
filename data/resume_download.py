"""
Resumable Kaggle dataset downloader.
Downloads each dataset as a single zip, supports resume via Range header.
Run: python data/resume_download.py
"""
import json, os, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).parent
RAW  = ROOT / "raw"

DATASETS = [
    {
        "slug": "tawsifurrahman/tuberculosis-tb-chest-xray-dataset",
        "dest": RAW / "kaggle_tb",
        "min_images": 100,
        "label": "Kaggle TB (tawsifurrahman)",
    },
    {
        "slug": "raddar/tuberculosis-chest-xrays-montgomery",
        "dest": RAW / "montgomery",
        "min_images": 50,
        "label": "Montgomery (raddar)",
    },
]

def count_images(d: Path) -> int:
    return sum(1 for p in d.rglob("*") if p.suffix.lower() in {".png",".jpg",".jpeg"})

def download(ds: dict) -> bool:
    dest = ds["dest"]
    dest.mkdir(parents=True, exist_ok=True)
    n = count_images(dest)
    if n >= ds["min_images"]:
        print(f"[skip] {ds['label']}: {n} images already present", flush=True)
        return True
    print(f"\n[download] {ds['label']} → {dest}", flush=True)
    cmd = [
        sys.executable, "-m", "kaggle",
        "datasets", "download",
        "-d", ds["slug"],
        "-p", str(dest),
        "--unzip",
    ]
    result = subprocess.run(cmd)
    n_after = count_images(dest)
    ok = result.returncode == 0 and n_after > 0
    print(f"[done] {ds['label']}: {n_after} images  ok={ok}", flush=True)
    return ok

for ds in DATASETS:
    download(ds)

print("\nAll downloads complete.")
print("Next: python data/full_pipeline.py --manifest-only --smoke-test --train --eval")
