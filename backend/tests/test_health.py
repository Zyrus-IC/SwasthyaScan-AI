"""
SwasthyaScan AI ”” Tests: Health Endpoints
========================================
Tests for GET /health and GET /api/model-status.

Run with:
    cd backend
    pytest tests/test_health.py -v
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# â”€â”€ GET /health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestHealth:
    """Tests for the /health endpoint."""

    def test_health_returns_200(self) -> None:
        response = client.get("/health")
        assert response.status_code == 200, response.text

    def test_health_response_schema(self) -> None:
        data = client.get("/health").json()
        assert "status" in data
        assert "version" in data
        assert "model_loaded" in data
        assert "components" in data

    def test_health_status_is_string(self) -> None:
        data = client.get("/health").json()
        assert isinstance(data["status"], str)
        assert data["status"] in ("ok", "degraded")

    def test_health_model_loaded_is_bool(self) -> None:
        data = client.get("/health").json()
        assert isinstance(data["model_loaded"], bool)

    def test_health_components_is_list(self) -> None:
        data = client.get("/health").json()
        assert isinstance(data["components"], list)
        assert len(data["components"]) > 0

    def test_health_components_have_required_fields(self) -> None:
        data = client.get("/health").json()
        for component in data["components"]:
            assert "name" in component
            assert "status" in component

    def test_health_model_not_loaded_by_default(self) -> None:
        """
        By default (no MODEL_WEIGHTS_PATH set), model_loaded must be False.
        This confirms the honest 'unavailable' behaviour.
        """
        data = client.get("/health").json()
        # In test environment, no model is configured.
        # Adjust if a test fixture sets MODEL_WEIGHTS_PATH.
        assert data["model_loaded"] is False


# â”€â”€ GET /api/model-status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestModelStatus:
    """Tests for the /api/model-status endpoint."""

    def test_model_status_returns_200(self) -> None:
        response = client.get("/api/model-status")
        assert response.status_code == 200

    def test_model_status_schema(self) -> None:
        data = client.get("/api/model-status").json()
        assert "model_configured" in data
        assert "model_loaded" in data
        assert "weights_path_set" in data
        assert "detail" in data

    def test_model_status_not_configured_by_default(self) -> None:
        data = client.get("/api/model-status").json()
        assert data["model_configured"] is False
        assert data["weights_path_set"] is False

    def test_model_status_detail_is_string(self) -> None:
        data = client.get("/api/model-status").json()
        assert isinstance(data["detail"], str)
        assert len(data["detail"]) > 0

