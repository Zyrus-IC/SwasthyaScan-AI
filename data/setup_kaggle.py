"""
setup_kaggle.py — Quick Kaggle credentials setup helper
========================================================
Run this script to configure Kaggle API credentials so that
data/download_datasets.py can download the TB chest X-ray datasets.

Usage:
    python data/setup_kaggle.py

You will need:
    1. A Kaggle account (free): https://www.kaggle.com
    2. An API token from: https://www.kaggle.com/settings > API > "Create New Token"
       This downloads a kaggle.json file with your username and key.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def main() -> None:
    kaggle_dir = Path.home() / ".kaggle"
    kaggle_json = kaggle_dir / "kaggle.json"

    print("=" * 60)
    print("  SwasthyaScan AI — Kaggle Credentials Setup")
    print("=" * 60)
    print()

    if kaggle_json.exists():
        try:
            with open(kaggle_json) as f:
                existing = json.load(f)
            user = existing.get("username", "?")
            print(f"[OK] Kaggle credentials already configured for user: {user}")
            print(f"     Location: {kaggle_json}")
            print()
            print("To re-configure, delete the file and run this script again.")
            return
        except Exception:
            print(f"[WARNING] Existing kaggle.json at {kaggle_json} could not be parsed.")

    print("Steps to get your Kaggle API token:")
    print("  1. Go to: https://www.kaggle.com/settings")
    print("  2. Scroll to the 'API' section")
    print("  3. Click 'Create New Token'")
    print("  4. A kaggle.json file will be downloaded")
    print()

    method = input("Choose setup method:\n  [1] Enter username + key manually\n  [2] Provide path to downloaded kaggle.json\nChoice (1 or 2): ").strip()

    if method == "2":
        src_path = input("Path to your downloaded kaggle.json: ").strip().strip('"')
        src = Path(src_path)
        if not src.exists():
            print(f"ERROR: File not found: {src}")
            sys.exit(1)
        try:
            with open(src) as f:
                creds = json.load(f)
            if "username" not in creds or "key" not in creds:
                print("ERROR: kaggle.json must contain 'username' and 'key' fields.")
                sys.exit(1)
            kaggle_dir.mkdir(exist_ok=True)
            with open(kaggle_json, "w") as f:
                json.dump(creds, f)
            os.chmod(kaggle_json, 0o600)
            print(f"\n[OK] Credentials saved to {kaggle_json}")
            print(f"     Username: {creds['username']}")
        except Exception as e:
            print(f"ERROR: {e}")
            sys.exit(1)
    else:
        username = input("Kaggle username: ").strip()
        key = input("Kaggle API key: ").strip()
        if not username or not key:
            print("ERROR: Username and key cannot be empty.")
            sys.exit(1)
        creds = {"username": username, "key": key}
        kaggle_dir.mkdir(exist_ok=True)
        with open(kaggle_json, "w") as f:
            json.dump(creds, f)
        os.chmod(kaggle_json, 0o600)
        print(f"\n[OK] Credentials saved to {kaggle_json}")

    print()
    print("Now run the dataset downloader:")
    print("  python data/download_datasets.py")


if __name__ == "__main__":
    main()
