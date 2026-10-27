"""
SwasthyaScan AI — Groq Chat Endpoint
=====================================
POST /api/chat

Accepts conversation messages and an optional scan report context.
Returns a genuine AI-generated response via the Groq API.

Security rules (non-negotiable):
  - The GROQ_API_KEY is read from the server environment only.
  - It is never returned to the browser or logged.
  - The browser calls this backend endpoint — it never contacts Groq directly.
  - No raw medical images are sent to Groq.
  - Request sizes and history depth are capped.
  - Stack traces are never returned to the client.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings

router = APIRouter(prefix="/api", tags=["chat"])
logger = logging.getLogger(__name__)

# ── Request / response schemas ──────────────────────────────────────────────

MAX_MESSAGE_CHARS = 2000   # per user message
MAX_HISTORY_MSGS  = 10     # system enforced max (also checked on frontend)


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS)

    @field_validator("content")
    @classmethod
    def strip_content(cls, v: str) -> str:
        return v.strip()


class ScanReport(BaseModel):
    """Structured fields from the TB scan result — no raw images."""
    status: Optional[str] = None          # e.g. "completed", "unavailable"
    prediction: Optional[str] = None      # "TB" or "Normal" if model ran
    score: Optional[float] = None         # model score (NOT a probability)
    message: Optional[str] = None         # reliability engine summary
    limitations: Optional[list[str]] = None
    review_reasons: Optional[list[str]] = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS)
    history: list[ChatMessage] = Field(default_factory=list, max_length=MAX_HISTORY_MSGS)
    report: Optional[ScanReport] = None   # optional: inject scan context


class ChatResponse(BaseModel):
    reply: str
    groq_available: bool


# ── System prompt ──────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are the SwasthyaScan AI Assistant — a specialist TB education and report-support assistant.

YOUR ROLE:
- Help users understand Tuberculosis (TB) and their SwasthyaScan AI scan report.
- Provide evidence-based educational information about TB symptoms, transmission, diagnosis, treatment adherence, and follow-up.
- Explain scan report findings in plain language.
- Guide users toward appropriate next steps.

ALLOWED TOPICS:
- Common TB symptoms (persistent cough, fever, night sweats, weight loss, fatigue, haemoptysis)
- TB transmission, prevention, and infection control
- Pulmonary and extrapulmonary TB education
- Chest X-ray terminology and screening limitations
- Diagnostic tests (sputum culture, GeneXpert, IGRA, TST) and clinical assessment process
- General TB treatment concepts (DOTS, adherence, drug-resistant TB awareness)
- Common medication safety questions (but never prescribe or change doses)
- Follow-up care guidance
- TB stigma, emotional support, patient education
- The user's actual SwasthyaScan AI scan report and its documented limitations

SAFETY RULES (MANDATORY — never break these):
1. Never diagnose or rule out TB. Use phrases like "the screening result" not "you have TB" or "you don't have TB".
2. Never prescribe medication, invent dosages, or tell users to change/stop prescribed medicine.
3. Never claim the AI scan result is a confirmed medical diagnosis.
4. Always recommend professional clinical evaluation for concerning symptoms.
5. If the user reports severe breathing difficulty, significant coughing of blood, or other serious emergency symptoms, prioritise immediate medical emergency guidance above all else.
6. Admit uncertainty rather than guessing at medical facts.
7. Clearly separate educational information from medical decisions.
8. A low or negative screening result NEVER means the person definitely does not have TB.

OFF-TOPIC HANDLING:
- For questions unrelated to TB, chest health, or the scan report: politely say you specialise in TB-related support and offer to answer TB-related questions instead.
- Apply this rule based on actual intent, not keyword matching.

REPORT CONTEXT:
- When a scan report is provided, explain only what is actually in the report. Do not invent findings.
- Explain the difference between an AI screening result and a clinician's diagnosis.
- If the report says "Unable to Assess" or model is unavailable, explain this honestly.

TONE: Calm, empathetic, non-judgmental, clear, and accessible. Avoid medical jargon unless you immediately explain it."""


def _build_report_context(report: ScanReport) -> str:
    """Build a concise, safe text summary of the scan report for the system prompt."""
    if report is None:
        return ""
    lines = ["\\n\\n--- USER'S SCAN REPORT CONTEXT ---"]
    lines.append(f"Screening status: {report.status or 'unknown'}")
    if report.prediction:
        lines.append(f"Model prediction: {report.prediction}")
    if report.score is not None:
        lines.append(
            f"Model score: {report.score:.3f} (note: this is NOT a calibrated probability)"
        )
    if report.message:
        lines.append(f"System message: {report.message}")
    if report.limitations:
        lines.append("Documented limitations: " + "; ".join(report.limitations[:3]))
    if report.review_reasons:
        lines.append("Review reasons: " + "; ".join(report.review_reasons[:3]))
    lines.append(
        "IMPORTANT: The above is an AI screening output — not a clinical diagnosis. "
        "Always encourage appropriate professional assessment."
    )
    lines.append("--- END REPORT CONTEXT ---")
    return "\\n".join(lines)


# ── Endpoint ───────────────────────────────────────────────────────────────

@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="TB-focused AI chat via Groq",
    description=(
        "Sends a user message (with optional conversation history and scan report context) "
        "to the Groq API and returns a genuine AI-generated response. "
        "The GROQ_API_KEY is kept server-side and is never returned to the browser."
    ),
)
async def chat(request: ChatRequest) -> ChatResponse:
    if not settings.groq_configured:
        logger.warning("Chat endpoint called but GROQ_API_KEY is not configured.")
        return ChatResponse(
            reply=(
                "The AI assistant is not currently configured. "
                "To enable it, set the GROQ_API_KEY in the backend .env file. "
                "I can still provide general information about TB screening and this prototype."
            ),
            groq_available=False,
        )

    try:
        from groq import Groq  # lazy import — only needed when configured
    except ImportError:
        logger.error("groq package is not installed. Run: pip install groq")
        return ChatResponse(
            reply=(
                "The AI assistant package is not installed on this server. "
                "Please contact the administrator."
            ),
            groq_available=False,
        )

    # Build system prompt (with optional report context appended)
    report_context = _build_report_context(request.report) if request.report else ""
    system_content = _SYSTEM_PROMPT + report_context

    # Build message list for Groq
    messages: list[dict] = [{"role": "system", "content": system_content}]

    # Add prior conversation history (capped)
    for msg in request.history[-settings.chat_max_history:]:
        messages.append({"role": msg.role, "content": msg.content})

    # Add the current user message
    messages.append({"role": "user", "content": request.message})

    try:
        client = Groq(api_key=settings.groq_api_key)
        completion = client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            max_tokens=settings.chat_max_tokens,
            temperature=settings.chat_temperature,
        )
        reply = completion.choices[0].message.content or ""
        logger.info(
            "Chat response generated: model=%s tokens_used=%s",
            settings.groq_model,
            getattr(completion.usage, "total_tokens", "?"),
        )
        return ChatResponse(reply=reply.strip(), groq_available=True)

    except Exception as exc:
        # Never expose the exception details or API key to the browser
        logger.error("Groq API error: %s", type(exc).__name__, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "The AI assistant is temporarily unavailable. "
                "Please try again in a moment."
            ),
        ) from exc
