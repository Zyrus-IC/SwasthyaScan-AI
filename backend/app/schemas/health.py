"""
SwasthyaScan AI ”” Pydantic Schemas: Health
=========================================
Response models for the /health and /api/model-status endpoints.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ComponentStatus(BaseModel):
    """Status of a single system component."""

    name: str
    status: str = Field(description="'ok' | 'unavailable' | 'checking'")
    detail: str | None = None


class HealthResponse(BaseModel):
    """
    GET /health response.

    model_loaded is kept for backward-compatibility with the frontend
    SystemStatusCard that already checks d.model_loaded.
    """

    model_config = ConfigDict(protected_namespaces=())

    status: str = Field(description="'ok' | 'degraded'")
    version: str
    model_loaded: bool = Field(
        description="True only when a verified model has been loaded."
    )
    components: list[ComponentStatus]
    message: str | None = None


class ModelStatusResponse(BaseModel):
    """GET /api/model-status response."""

    model_config = ConfigDict(protected_namespaces=())

    model_configured: bool
    model_loaded: bool
    weights_path_set: bool
    detail: str

