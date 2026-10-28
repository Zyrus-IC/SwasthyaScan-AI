"""
SwasthyaScan AI — FastAPI Application Entry Point
================================================
Run with:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import health as health_router
from app.api import screening as screening_router
from app.api import chat as chat_router
from app.api import environment as environment_router
from app.api import auth as auth_router
from app.core.config import settings
from app.db.database import init_db
from app.services import model_service
from app.services.retention_service import cleanup_loop, run_cleanup
from app.services.upload_service import init_uploads

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info(
        "SwasthyaScan AI backend starting — version=%s model_configured=%s threshold=%.4f",
        settings.app_version, settings.model_configured, settings.model_threshold,
    )

    # ── Expose env vars read by services ─────────────────────────────────────
    os.environ["MODEL_THRESHOLD"]         = str(settings.model_threshold)
    os.environ["MODEL_VERIFIED"]          = str(settings.model_verified).lower()
    os.environ["ENVIRONMENT_EXPIRY_HOURS"] = str(settings.environment_expiry_hours)

    # ── DB + uploads ──────────────────────────────────────────────────────────
    backend_root = Path(__file__).parent.parent  # backend/
    db_path      = backend_root / settings.db_path
    uploads_dir  = backend_root / settings.uploads_dir

    init_db(db_path)
    init_uploads(uploads_dir)
    logger.info("Database: %s", db_path)
    logger.info("Uploads:  %s", uploads_dir)
    logger.info("MODEL_VERIFIED: %s", os.environ["MODEL_VERIFIED"])

    # ── Initial retention cleanup ─────────────────────────────────────────────
    try:
        n = run_cleanup()
        if n:
            logger.info("Startup cleanup: removed %d expired environment(s).", n)
    except Exception as exc:
        logger.warning("Startup cleanup error (non-fatal): %s", exc)

    # ── Model loading ─────────────────────────────────────────────────────────
    if settings.model_configured:
        loaded = model_service.load_model(settings.model_weights_path)
        if loaded:
            logger.info("Model loaded at startup. Threshold=%.4f", settings.model_threshold)
        else:
            logger.warning(
                "MODEL_WEIGHTS_PATH set (%s) but model failed to load.",
                settings.model_weights_path,
            )
    else:
        logger.info("MODEL_WEIGHTS_PATH not set — inference returns 'Unable to Assess'.")

    logger.info("CORS origins: %s", settings.cors_origins_list)
    logger.info("Docs: http://localhost:%d/docs", settings.backend_port)

    # ── Background cleanup loop ───────────────────────────────────────────────
    cleanup_task = asyncio.create_task(cleanup_loop())

    yield  # ← application runs

    cleanup_task.cancel()
    logger.info("SwasthyaScan AI backend shutting down.")


# ── FastAPI application ───────────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=settings.app_description,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Accept", "X-Session-Token", "Authorization"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health_router.router)
app.include_router(auth_router.router)
app.include_router(screening_router.router)
app.include_router(chat_router.router)
app.include_router(environment_router.router)


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception on %s %s: %s",
                 request.method, request.url, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again."},
    )
