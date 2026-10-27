"""
SwasthyaScan AI — Health and Model-Status Routes
===============================================
GET /health          — service liveness + model status
GET /api/model-status — detailed model availability
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from app.core.config import settings
from app.schemas.health import ComponentStatus, HealthResponse, ModelStatusResponse
from app.services import model_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health check",
    description=(
        "Returns backend service status and whether a verified model is "
        "configured.  The frontend SystemStatusCard polls this endpoint."
    ),
)
async def health_check() -> HealthResponse:
    model_actually_loaded = model_service.is_model_loaded()

    components: list[ComponentStatus] = [
        ComponentStatus(
            name="FastAPI service",
            status="ok",
            detail="Running normally.",
        ),
        ComponentStatus(
            name="Image validation",
            status="ok",
            detail="Pillow-based format and decode checks available.",
        ),
        ComponentStatus(
            name="AI model",
            status="ok" if model_actually_loaded else "unavailable",
            detail=(
                "Model weights loaded and ready for inference."
                if model_actually_loaded
                else (
                    "No model weights path is set. "
                    "The service returns an honest 'Unable to Assess' state — "
                    "this is the expected behaviour at the current development stage."
                    if not settings.model_configured
                    else "Model weights path is set but model could not be loaded."
                )
            ),
        ),
    ]

    overall = "ok" if all(c.status == "ok" for c in components) else "degraded"

    return HealthResponse(
        status=overall,
        version=settings.app_version,
        model_loaded=model_actually_loaded,
        components=components,
        message=(
            None
            if model_actually_loaded
            else "Model not configured — prototype running in honest unavailable mode."
        ),
    )


@router.get(
    "/api/model-status",
    response_model=ModelStatusResponse,
    summary="AI model availability",
    description="Returns detailed information about AI model configuration.",
)
async def model_status() -> ModelStatusResponse:
    configured = settings.model_configured
    loaded = model_service.is_model_loaded()
    return ModelStatusResponse(
        model_configured=configured,
        model_loaded=loaded,
        weights_path_set=bool(settings.model_weights_path.strip()),
        detail=(
            f"Model weights loaded successfully and ready for inference (device: {model_service._device})."
            if loaded
            else (
                "A model weights path has been set but the model failed to load at startup. "
                "Check the backend logs for details."
                if configured
                else (
                    "MODEL_WEIGHTS_PATH is not set in the environment. "
                    "Set this to a verified model weight file to enable inference. "
                    "Until then, the screening endpoint returns an honest 'Unable to Assess' state."
                )
            )
        ),
    )
