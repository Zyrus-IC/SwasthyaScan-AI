# PulmoSure AI (SwasthyaScan AI)
> Reliability-aware Tuberculosis Screening Research Prototype

[![Python](https://img.shields.io/badge/Python-3.11+-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev)
[![Tests](https://img.shields.io/badge/Tests-43%20passed-brightgreen)]()

---

## ⚠️ Critical Medical Safety Notice

> **This is a research prototype and educational demonstration. It is NOT a medical device, NOT clinically validated, and must NOT be used for actual tuberculosis diagnosis or clinical decision-making.**

All results are clearly labelled with this disclaimer throughout the application. When no model is configured, the system returns an honest **"Unable to Assess"** state — never a fabricated result.

---

## Overview

PulmoSure AI is a full-stack TB screening support system built for the **HorizonXT 2026** hackathon. It features:

- **DenseNet121** deep learning model trained on NLM Shenzhen + Kaggle TB datasets
- **Reliability engine** — multi-signal confidence assessment (not just a raw score)
- **Grad-CAM** explainability heatmaps showing model attention regions
- **Groq-powered AI chatbot** for TB education and report discussion
- **Obsidian Aurora** design system with animated 3D lung background
- **43 passing backend tests** covering all API contracts

---

## Project Structure

```
PulmoSure/
├── backend/                  FastAPI backend
│   ├── app/
│   │   ├── api/
│   │   │   ├── screening.py  POST /api/screening/analyze
│   │   │   ├── chat.py       POST /api/chat (Groq proxy)
│   │   │   └── health.py     GET /health
│   │   ├── core/config.py    Pydantic settings
│   │   ├── schemas/          Pydantic request/response models
│   │   └── services/
│   │       ├── model_service.py    DenseNet121 inference
│   │       ├── image_service.py    Image validation
│   │       ├── gradcam_service.py  Grad-CAM explainability
│   │       └── reliability.py      Reliability engine
│   ├── tests/                43 pytest tests
│   ├── requirements.txt
│   └── .env.example
│
├── data/                     Training pipeline
│   ├── download_datasets.py  NLM Shenzhen + Kaggle TB downloader
│   ├── prepare_dataset.py    Manifest + train/val/test splits
│   ├── train_model.py        DenseNet121 fine-tuning
│   └── evaluate_model.py     Metrics evaluation
│
├── frontend/                 React 19 + Vite + TailwindCSS v4
│   └── src/
│       ├── pages/            LandingPage, ScreeningPage, ResultsPage, …
│       ├── components/       Navbar, ChatBot, BackgroundVideo, …
│       └── hooks/            useSmoothScroll, ReportContext
│
└── model_artifacts/          Trained weights (after training)
```

---

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

# Install PyTorch with CUDA support (RTX 3050 — CUDA 12.4)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124

# Copy and fill in environment variables
cp .env.example .env

# Run the backend
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Environment Variables (backend/.env)

| Variable | Required | Description |
|---|---|---|
| `MODEL_WEIGHTS_PATH` | Optional | Absolute path to `densenet121_tb.pth`. Leave empty for "model not configured" mode. |
| `GROQ_API_KEY` | Optional | Groq API key for the AI chatbot. Get free at [console.groq.com](https://console.groq.com/keys) |
| `GROQ_MODEL` | Optional | Default: `llama3-8b-8192` |
| `CORS_ORIGINS` | Optional | Comma-separated allowed frontend origins |

---

## Training the Model

### Step 1 — Download datasets

```bash
python data/download_datasets.py
```

This downloads NLM Shenzhen (official) and Kaggle TB datasets.
**Requires:** `~2 GB` disk space. Kaggle datasets require `~/.kaggle/kaggle.json`.

### Step 2 — Prepare dataset

```bash
python data/prepare_dataset.py
```

Builds `data/processed/{manifest,train,val,test}.csv`.

### Step 3 — Train

```bash
# Quick sanity check (2 epochs, ~100 images)
python data/train_model.py --test-run

# Full training (RTX 3050, ~30–60 min)
python data/train_model.py
```

Outputs: `model_artifacts/densenet121_tb.pth`, `training_log.json`, `model_card.json`

### Step 4 — Connect to backend

Set in `backend/.env`:
```
MODEL_WEIGHTS_PATH=E:/PROJECT/PulmoSure/model_artifacts/densenet121_tb.pth
```

Restart the backend — inference and Grad-CAM will activate automatically.

---

## API Reference

### `POST /api/screening/analyze`

Multipart form upload. Fields:
- `image` — JPEG or PNG chest X-ray (max 10 MB)
- `symptoms` — JSON string (all fields optional)

Response always returns a structured `ScreeningResponse` with:
- `status`: `completed | limited | review_recommended | unavailable`
- `model_output`: only present when a verified model ran
- `gradcam_heatmap`: base64 PNG, only present with model output
- `reliability_flags`: transparency audit trail
- `limitations`: explicitly documented caveats

### `POST /api/chat`

```json
{
  "message": "Explain my scan result",
  "history": [],
  "report": { "status": "unavailable", "message": "..." }
}
```

### `GET /health`

Returns system health and model loaded status.

---

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
# 43 tests — all should pass
```

---

## Design System — Obsidian Aurora

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#07080B` | Page background |
| `--ember` | `#34F5C5` | Mint emerald primary |
| `--violet` | `#8B5CF6` | Electric violet accent |
| `--text-primary` | `#F1F5F9` | Body text |

---

## Medical Safety Architecture

The reliability engine explicitly implements these safety rules:

1. **No fabricated predictions** — model output is `null` when no verified model is configured
2. **Unavailable ≠ Negative** — all "unable to assess" states include explicit disclaimer
3. **Hemoptysis escalation** — blood in sputum always triggers review recommendation
4. **Conflicting evidence flag** — low model score + multiple symptoms triggers warning
5. **Prototype labelling** — all thresholds are labelled `[PROTOTYPE RULE — not clinically validated]`

---

*Built for HorizonXT 2026 | Research prototype only*
