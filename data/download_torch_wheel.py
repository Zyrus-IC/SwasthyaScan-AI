"""
download_torch_wheel.py
=======================
Downloads the PyTorch CUDA 12.4 wheel directly using urllib, avoiding
pip's CDN hash-mismatch issue, then installs it locally.

Run from the project root:
    python data/download_torch_wheel.py

GPU: RTX 3050 Laptop (4 GB VRAM, CUDA 12.4)
Python: 3.11 (cp311-cp311-win_amd64)
"""

from __future__ import annotations

import subprocess
import sys
import urllib.request
from pathlib import Path

TORCH_URL = (
    "https://download.pytorch.org/whl/cu124/"
    "torch-2.4.1%2Bcu124-cp311-cp311-win_amd64.whl"
)
TORCHVISION_URL = (
    "https://download.pytorch.org/whl/cu124/"
    "torchvision-0.19.1%2Bcu124-cp311-cp311-win_amd64.whl"
)

DEST_DIR = Path(__file__).parent.parent / ".torch_wheels"
DEST_DIR.mkdir(exist_ok=True)

TORCH_WHL      = DEST_DIR / "torch-2.4.1+cu124-cp311-cp311-win_amd64.whl"
TORCHVISION_WHL = DEST_DIR / "torchvision-0.19.1+cu124-cp311-cp311-win_amd64.whl"


def download(url: str, dest: Path) -> bool:
    if dest.exists() and dest.stat().st_size > 100_000_000:
        print(f"[skip] {dest.name} already exists ({dest.stat().st_size // 1e6:.0f} MB)")
        return True
    print(f"[download] {dest.name}  ({url})")
    try:
        def progress(block_num: int, block_size: int, total_size: int) -> None:
            if total_size > 0:
                pct = block_num * block_size / total_size * 100
                mb  = block_num * block_size / 1e6
                print(f"\r  {pct:.1f}%  {mb:.0f}/{total_size/1e6:.0f} MB", end="", flush=True)
        urllib.request.urlretrieve(url, dest, reporthook=progress)
        print()
        print(f"[ok] Saved {dest.name} ({dest.stat().st_size // 1e6:.0f} MB)")
        return True
    except Exception as e:
        print(f"\n[error] Download failed: {e}")
        return False


def install(whl: Path) -> bool:
    print(f"\n[install] {whl.name}")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", str(whl), "--no-deps"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"[error] {result.stderr[-500:]}")
        return False
    print(f"[ok] Installed {whl.name}")
    return True


def install_deps() -> None:
    """Install remaining torch dependencies after --no-deps install."""
    deps = ["filelock", "fsspec", "networkx", "sympy", "jinja2", "typing_extensions"]
    print("\n[deps] Installing torch runtime dependencies...")
    subprocess.run(
        [sys.executable, "-m", "pip", "install"] + deps,
        capture_output=False, text=True,
    )


def main() -> None:
    print("=" * 60)
    print("  PyTorch CUDA 12.4 Direct Wheel Installer")
    print("=" * 60)

    # Check if already installed
    try:
        import torch
        print(f"\n[ok] PyTorch already installed: {torch.__version__}")
        print(f"     CUDA available: {torch.cuda.is_available()}")
        return
    except ImportError:
        pass

    # Download torch wheel
    if not download(TORCH_URL, TORCH_WHL):
        sys.exit(1)

    # Install torch (no-deps to skip hash check)
    if not install(TORCH_WHL):
        sys.exit(1)

    # Install dependencies
    install_deps()

    # Download + install torchvision
    if download(TORCHVISION_URL, TORCHVISION_WHL):
        install(TORCHVISION_WHL)

    # Verify
    print("\n[verify] Testing import...")
    result = subprocess.run(
        [sys.executable, "-c",
         "import torch; print(f'torch {torch.__version__}, CUDA={torch.cuda.is_available()}')"],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        print(f"[ok] {result.stdout.strip()}")
    else:
        print(f"[error] {result.stderr.strip()}")


if __name__ == "__main__":
    main()
