"""
SwasthyaScan AI — FastAPI Application Entry Point
================================================
Creates and configures the FastAPI application.

Run with:
    uvicorn app.main:app --reload --port 8000

Or via the convenience script:
    python -m uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import health as health_router
from app.api import screening as screening_router
from app.api import chat as chat_router
from app.core.config import settings
from app.services import model_service

# ── Logging configuration ───────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


# ── Lifespan events ─────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:  # noqa: ARG001
    # startup
    logger.info(
        "PulmoSure AI backend starting — version=%s model_configured=%s threshold=%.4f",
        settings.app_version,
        settings.model_configured,
        settings.model_threshold,
    )
    # Expose threshold to model_service (reads via os.environ)
    import os
    os.environ["MODEL_THRESHOLD"] = str(settings.model_threshold)

    if settings.model_configured:
        # Attempt to load model weights at startup
        loaded = model_service.load_model(settings.model_weights_path)
        if loaded:
            logger.info(
                "DenseNet121 model loaded successfully at startup. Threshold=%.4f",
                settings.model_threshold,
            )
        else:
            logger.warning(
                "MODEL_WEIGHTS_PATH is set (%s) but model could not be loaded. "
                "Inference will return 'Unable to Assess'.",
                settings.model_weights_path,
            )
    else:
        logger.info(
            "MODEL_WEIGHTS_PATH is not set. "
            "The screening endpoint will return an honest 'Unable to Assess' state. "
            "This is the expected behaviour during prototype development."
        )
    logger.info("CORS origins: %s", settings.cors_origins_list)
    logger.info("Docs available at http://localhost:%d/docs", settings.backend_port)

    yield  # application runs here

    # shutdown
    logger.info("SwasthyaScan AI backend shutting down.")

# ── FastAPI application ──────────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=settings.app_description,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Allows the local Vite dev server (http://localhost:5173) to call the backend.
# In production, restrict to the actual deployed frontend origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Accept"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(health_router.router)    # /health, /api/model-status
app.include_router(screening_router.router) # /api/screening/analyze
app.include_router(chat_router.router)      # /api/chat


# ── Global exception handler ─────────────────────────────────────────────────
# Prevents internal stack traces from leaking to API consumers.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again."},
    )
