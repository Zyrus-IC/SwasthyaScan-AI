# SwasthyaScan AI — Architecture Overview

> **Status:** Research prototype. Not a clinically validated medical device.

---

## System Overview

SwasthyaScan AI is a full-stack TB screening support web application with:

- **Frontend:** React + Vite + TypeScript (port 5173 in development)
- **Backend:** FastAPI + Python (port 8000 in development)
- **Database:** SQLite (local, `backend/data/swasthyascan.db`)
- **AI Inference:** EfficientNet-B0 model (local, server-side only)
- **AI Chatbot:** Groq API (server-side proxy, key never exposed to browser)

---

## Component Map

```
Browser (React)
    │
    ├─► /api/chat         ──► FastAPI backend ──► Groq API (LLM)
    ├─► /api/screen       ──► FastAPI backend ──► Local ML model
    ├─► /api/env          ──► FastAPI backend ──► SQLite DB
    └─► /health           ──► FastAPI backend  (status check)
```

The Vite dev server proxies all `/api/*` and `/health` requests to the backend
(see `frontend/vite.config.ts`). In production, a reverse proxy (nginx / Cloud Run)
handles this routing.

---

## SwasthyaScan AI Chatbot

### How It Works

1. The user types a message in the chat panel (max 500 characters).
2. The **frontend** sends only that typed text — plus a capped conversation history
   (last 8 messages) — to `POST /api/chat` on the **backend**.
3. The **backend** prepends a fixed server-side system prompt, then forwards the
   request to the **Groq API** using the `GROQ_API_KEY` environment variable.
4. The Groq response is returned to the frontend as plain text.
5. The backend returns the reply to the browser.

### What Is Sent to Groq

| Sent | Not Sent |
|------|----------|
| User's typed chat messages | X-ray images or scan images |
| Conversation history (last 8 msgs, capped at 500 chars each) | Questionnaire answers |
| Fixed server-side system prompt | Model scores or raw results |
| | Patient identifiers or personal data |

### What Is Stored

**Nothing.** Chat history lives in React component state only. It is cleared when
the browser tab is closed or the user clicks "Clear conversation". No chat messages
are written to the database, logs, or any persistent store.

### Security Controls

- `GROQ_API_KEY` is read exclusively from `backend/.env` (server environment).
- The key is **never** logged, printed, or returned to the browser.
- The frontend has no knowledge of the key — it only calls `/api/chat`.
- Rate limiting: 20 requests per minute per IP address (in-memory).
- Request validation: max 500 chars per message, max 8 messages history,
  only `user` / `assistant` roles accepted (never `system` from client).
- The fixed system prompt restricts the assistant to TB and health topics only.
  Prompt-injection attempts are rejected by the system prompt rules.
- Timeouts: 30-second request timeout on Groq calls.
- CORS: only the configured frontend origin(s) are allowed.

### Required Environment Variables

Set these in `backend/.env` (see `backend/.env.example` for a template):

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ Yes | Groq API key — get it at https://console.groq.com/keys |
| `GROQ_MODEL` | No | Model name (default: `llama-3.1-8b-instant`) |
| `CHAT_MAX_TOKENS` | No | Max tokens per reply (default: `800`) |
| `CHAT_TEMPERATURE` | No | Response temperature (default: `0.4`) |
| `CHAT_MAX_HISTORY` | No | Max history messages (default: `10`) |

---

## TB Screening Pipeline

```
Patient uploads CXR image
        │
        ▼
Image quality validation (backend)
        │
        ▼
EfficientNet-B0 inference (local, server-side)
        │
        ▼
Reliability engine (4-state result handling)
        │
        ▼
Result: Normal / TB / Conflicting / Unable to Assess
        │
        ▼
Doctor review dashboard (doctor portal)
```

- The AI model score is **not a calibrated probability**.
- `MODEL_VERIFIED=false` — this prototype has not undergone clinical validation.
- Grad-CAM++ heatmaps are provided as model explanation aids, not clinical findings.

---

## Data Flow — Privacy Summary

| Data type | Stored? | Sent to Groq? | Sent to any third party? |
|-----------|---------|--------------|--------------------------|
| X-ray images | Yes (local SQLite + uploads dir, expiry 24h) | ❌ No | ❌ No |
| Questionnaire answers | Yes (local DB, expiry 24h) | ❌ No | ❌ No |
| Chat messages | ❌ No (React state only) | ✅ Yes (typed text only) | ❌ No |
| Doctor notes | Yes (local DB) | ❌ No | ❌ No |

---

## Deployment Notes

- Copy `backend/.env.example` → `backend/.env` and fill in `GROQ_API_KEY`.
- `backend/.env` is in `.gitignore` — never commit it.
- For production, set `MODEL_VERIFIED=false` (default) until external clinical
  validation is complete. Never set it to `true` without proper validation.
