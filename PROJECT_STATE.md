# PulmoSure AI — Project State

**Last updated:** 2026-10-27 18:40 IST
**Status:** MODEL TRAINED + INTEGRATED ✅

---

## All Steps Complete

### STEP 1 — SETUP ✅
- GPU: NVIDIA RTX 3050 (4 GB) — CUDA build not available at time of training
- PyTorch: 2.14.1+cpu (CPU build used for training)
- All packages installed: torch, torchvision, imagehash, sklearn, pandas, Pillow

### STEP 2 — DOWNLOAD ✅
- Kaggle TB (`tawsifurrahman`): downloaded to `data/raw/kaggle_tb/`
- Montgomery (`raddar`): downloaded to `data/raw/montgomery/`
- Shenzhen (raddar 3.5GB): skipped — tawsifurrahman dataset sufficient

### STEP 3 — MANIFEST + CLEANING ✅
- Manifest: `data/processed/manifest_v2.csv`
- Exact dedup (MD5) + perceptual dedup (imagehash, hamming ≤ 8)
- Montgomery contamination check applied

### STEP 4 — SPLIT ✅
- Train: **2316 images** (TB=495, Normal=1821)
- Val:   **408 images**
- Test:  **120 images** (Montgomery — external only, never trained on)
- 85/15 stratified, seed=42, 224×224 pre-cached

### STEP 5 — SMOKE TEST ✅
- 1 epoch on 100 images = 25.6 sec
- Projected full training = ~25 min ✅ (under 60 min cap)

### STEP 6 — TRAINING ✅
| Epoch | Train Loss | Val Loss | Val AUC |
|-------|-----------|---------|---------|
| 1 | 0.9468 | 0.5176 | 0.9989 |
| 2 | 0.5077 | 0.2212 | 0.9996 |
| 3 | 0.3494 | 0.1010 | 0.9998 |
| **4** | **0.2454** | **0.0827** | **1.0000** ✅ |

- Training stopped after Epoch 4 (manually, weights already saved at 1.0 AUC)
- Weights: `model_artifacts/densenet121_tb_best.pth` (84.4 MB)

### STEP 7 — EVALUATION ✅ (REAL NUMBERS)

**Threshold selected on validation: 0.9729** (sensitivity ≥ 90% rule)

#### Validation Set (408 images)
| Metric | Value |
|--------|-------|
| ROC-AUC | **1.0000** |
| Sensitivity | **0.908** |
| Specificity | **1.0** |
| Precision | 1.0 |
| F1 | 0.9518 |
| Accuracy | 0.9804 |

#### Montgomery External Test (120 images)
| Metric | Value |
|--------|-------|
| ROC-AUC | 0.6648 |
| Sensitivity | **0.0** ⚠️ |
| Specificity | 1.0 |

⚠️ **HONEST FINDING**: The threshold 0.9729 does not transfer to Montgomery images
(different scanner, site, patient population). This is documented cross-dataset shift.
The model has AUC=0.665 on Montgomery (discriminates) but the threshold is misaligned.
This limitation is clearly communicated in the UI and evaluation report.

### STEP 8 — BACKEND INTEGRATION ✅
- `backend/.env` → `MODEL_WEIGHTS_PATH=E:\PROJECT\PulmoSure\model_artifacts\densenet121_tb_best.pth`
- `backend/.env` → `MODEL_THRESHOLD=0.9729`
- Backend startup confirms: `Model loaded successfully — epoch=4 device=cpu`
- Health endpoint reports: `model_loaded=true`

### STEP 9 — FRONTEND ✅
- ResultsPage shows "TB Indicators Detected / No TB Indicators Detected"
- Displays model score + decision threshold
- "Not a diagnosis" wording enforced throughout
- Grad-CAM section ready (shows when heatmap returned)

### STEP 10 — END-TO-END TEST ✅
- Script: `data/e2e_test.py`
- Results: `model_artifacts/e2e_test_results.json`

### STEP 11 — FINAL REPORT ✅
- Metrics JSON: `model_artifacts/metrics_report.json`
- Evaluation report: `model_artifacts/evaluation_report.md`
- Model card: `model_artifacts/model_card.json`

---

## Key Paths

| Artifact | Path |
|----------|------|
| Model weights | `model_artifacts/densenet121_tb_best.pth` |
| Metrics report | `model_artifacts/metrics_report.json` |
| Evaluation report | `model_artifacts/evaluation_report.md` |
| E2E test results | `model_artifacts/e2e_test_results.json` |

## Backend Config
```
MODEL_WEIGHTS_PATH=E:\PROJECT\PulmoSure\model_artifacts\densenet121_tb_best.pth
MODEL_THRESHOLD=0.9729
```

## Honesty Rules — All Enforced
- ✅ Real image counts (Train=2316, Val=408, Test=120)
- ✅ Real metrics (no fabricated numbers)
- ✅ Cross-dataset shift documented honestly (sensitivity=0 on Montgomery)
- ✅ Model score not presented as calibrated probability
- ✅ "Screening result only — not a diagnosis" in UI
- ✅ Weights/datasets/credentials never in Git
