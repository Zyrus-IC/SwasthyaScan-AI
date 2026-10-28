# SwasthyaScan AI
> Reliability-aware Tuberculosis Screening Research Prototype

[![Python](https://img.shields.io/badge/Python-3.11+-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev)
[![Tests](https://img.shields.io/badge/Tests-43%20passed-brightgreen)]()

---

## âš ï¸ Critical Medical Safety Notice

> **This is a research prototype and educational demonstration. It is NOT a medical device, NOT clinically validated, and must NOT be used for actual tuberculosis diagnosis or clinical decision-making.**

All results are clearly labelled with this disclaimer throughout the application. When no model is configured, the system returns an honest **"Unable to Assess"** state â€” never a fabricated result.

---

## Overview

SwasthyaScan AI AI is a full-stack TB screening support system built for the **HorizonXT 2026** hackathon. It features:

- **DenseNet121** deep learning model trained on NLM Shenzhen + Kaggle TB datasets
- **Reliability engine** â€” multi-signal confidence assessment (not just a raw score)
- **Grad-CAM** explainability heatmaps showing model attention regions
- **Groq-powered AI chatbot** for TB education and report discussion
- **Obsidian Aurora** design system with animated 3D lung background
- **43 passing backend tests** covering all API contracts

---

## Project Structure

```
SwasthyaScan AI/
â”œâ”€â”€ backend/                  FastAPI backend
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â”‚   â”œâ”€â”€ screening.py  POST /api/screening/analyze
â”‚   â”‚   â”‚   â”œâ”€â”€ chat.py       POST /api/chat (Groq proxy)
â”‚   â”‚   â”‚   â””â”€â”€ health.py     GET /health
â”‚   â”‚   â”œâ”€â”€ core/config.py    Pydantic settings
â”‚   â”‚   â”œâ”€â”€ schemas/          Pydantic request/response models
â”‚   â”‚   â””â”€â”€ services/
â”‚   â”‚       â”œâ”€â”€ model_service.py    DenseNet121 inference
â”‚   â”‚       â”œâ”€â”€ image_service.py    Image validation
â”‚   â”‚       â”œâ”€â”€ gradcam_service.py  Grad-CAM explainability
â”‚   â”‚       â””â”€â”€ reliability.py      Reliability engine
â”‚   â”œâ”€â”€ tests/                43 pytest tests
â”‚   â”œâ”€â”€ requirements.txt
â”‚   â””â”€â”€ .env.example
â”‚
â”œâ”€â”€ data/                     Training pipeline
â”‚   â”œâ”€â”€ download_datasets.py  NLM Shenzhen + Kaggle TB downloader
â”‚   â”œâ”€â”€ prepare_dataset.py    Manifest + train/val/test splits
â”‚   â”œâ”€â”€ train_model.py        DenseNet121 fine-tuning
â”‚   â””â”€â”€ evaluate_model.py     Metrics evaluation
â”‚
â”œâ”€â”€ frontend/                 React 19 + Vite + TailwindCSS v4
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ pages/            LandingPage, ScreeningPage, ResultsPage, â€¦
â”‚       â”œâ”€â”€ components/       Navbar, ChatBot, BackgroundVideo, â€¦
â”‚       â””â”€â”€ hooks/            useSmoothScroll, ReportContext
â”‚
â””â”€â”€ model_artifacts/          Trained weights (after training)
```

---

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

# Install PyTorch with CUDA support (RTX 3050 â€” CUDA 12.4)
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

### Step 1 â€” Download datasets

```bash
python data/download_datasets.py
```

This downloads NLM Shenzhen (official) and Kaggle TB datasets.
**Requires:** `~2 GB` disk space. Kaggle datasets require `~/.kaggle/kaggle.json`.

### Step 2 â€” Prepare dataset

```bash
python data/prepare_dataset.py
```

Builds `data/processed/{manifest,train,val,test}.csv`.

### Step 3 â€” Train

```bash
# Quick sanity check (2 epochs, ~100 images)
python data/train_model.py --test-run

# Full training (RTX 3050, ~30â€“60 min)
python data/train_model.py
```

Outputs: `model_artifacts/densenet121_tb.pth`, `training_log.json`, `model_card.json`

### Step 4 â€” Connect to backend

Set in `backend/.env`:
```
MODEL_WEIGHTS_PATH=./model_artifacts/densenet121_tb.pth
```

Restart the backend â€” inference and Grad-CAM will activate automatically.

---

## API Reference

### `POST /api/screening/analyze`

Multipart form upload. Fields:
- `image` â€” JPEG or PNG chest X-ray (max 10 MB)
- `symptoms` â€” JSON string (all fields optional)

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
# 43 tests â€” all should pass
```

---

## Design System â€” Obsidian Aurora

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#07080B` | Page background |
| `--ember` | `#34F5C5` | Mint emerald primary |
| `--violet` | `#8B5CF6` | Electric violet accent |
| `--text-primary` | `#F1F5F9` | Body text |

---

## Medical Safety Architecture

The reliability engine explicitly implements these safety rules:

1. **No fabricated predictions** â€” model output is `null` when no verified model is configured
2. **Unavailable â‰  Negative** â€” all "unable to assess" states include explicit disclaimer
3. **Hemoptysis escalation** â€” blood in sputum always triggers review recommendation
4. **Conflicting evidence flag** â€” low model score + multiple symptoms triggers warning
5. **Prototype labelling** â€” all thresholds are labelled `[PROTOTYPE RULE â€” not clinically validated]`

---

*Built for HorizonXT 2026 | Research prototype only*
