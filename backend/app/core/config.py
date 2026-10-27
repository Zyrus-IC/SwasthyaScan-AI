"""
SwasthyaScan AI — Application Settings
=====================================
Uses pydantic-settings so values can be read from:
  1. A `.env` file in the backend directory.
  2. Environment variables (take priority).
  3. Defaults defined here.

No secrets are hard-coded.  Copy .env.example → .env and fill in values.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        protected_namespaces=(),  # allow field names starting with 'model_'
    )

    # ── Server ──────────────────────────────────────────────────────────────
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Comma-separated origins; parsed into a list by the property below.
    cors_origins: str = (
        "http://localhost:5173,http://localhost:5174,http://localhost:4173"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # ── Model ─────────────────────────────────────────────────────────────────
    # Empty string → model is not configured; the API returns an honest
    # "Unable to Assess" result rather than fabricating a prediction.
    model_weights_path: str = ""

    # Decision threshold applied by model_service.run_inference().
    # Set to the value selected on the validation set in Step 7 evaluation
    # (rule: lowest threshold achieving sensitivity ≥ 90% on validation).
    # Default 0.5 until training is complete.
    model_threshold: float = 0.5

    @property
    def model_configured(self) -> bool:
        """True only when a non-empty path is set (existence verified at startup)."""
        return bool(self.model_weights_path.strip())

    # ── Upload limits ────────────────────────────────────────────────────────
    max_upload_size_mb: int = 10

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    # ── Logging ───────────────────────────────────────────────────────────────
    log_level: str = "INFO"

    # ── Environment feature (Doctor-Patient) ──────────────────────────────────
    db_path: str = "data/swasthyascan.db"
    uploads_dir: str = "data/uploads"
    environment_expiry_hours: float = 24.0
    # Set MODEL_VERIFIED=true ONLY after external clinical validation
    model_verified: bool = False

    # ── Groq chatbot ──────────────────────────────────────────────────────────
    # Server-side only. Never expose this in the frontend or logs.
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"  # configurable; use a currently supported model
    chat_max_tokens: int = 800
    chat_temperature: float = 0.4
    chat_max_history: int = 10  # max prior messages to send for context

    @property
    def groq_configured(self) -> bool:
        """True only when a non-empty Groq API key is set."""
        return bool(self.groq_api_key.strip())

    # ── Application metadata ─────────────────────────────────────────────────
    app_name: str = "SwasthyaScan AI"
    app_version: str = "0.5.0"
    app_description: str = (
        "Reliability-aware tuberculosis screening support research prototype."
    )


# Single shared instance — import this everywhere.
settings = Settings()
