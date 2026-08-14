from pathlib import Path
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve the .env file relative to this file's location:
# config.py is at backend/app/core/config.py
# .env is at the repo root (backend/app/core/../../../.env)
_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = "AI Study Assistant API"
    app_env: str = "development"
    app_debug: bool = True

    database_url: str = Field(default="postgresql+psycopg://postgres:postgres@localhost:5433/ai_study_assistant")

    jwt_secret_key: str = "change-me-in-dev"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60

    llm_provider: str = "gemini"
    llm_api_key: str | None = None
    llm_model: str = "gemini-3.5-flash"

    # Plain string — pydantic_settings will never try to JSON-decode a str field.
    # Parsed into a list via get_cors_origins() method used by main.py.
    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
    )

    def get_cors_origins(self) -> list[str]:
        """Return CORS_ORIGINS as a list, splitting on commas, stripping trailing slashes."""
        return [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]

    @field_validator("database_url", mode="before")
    @classmethod
    def parse_database_url(cls, v: Any) -> str:
        if isinstance(v, str):
            # Normalize Supabase postgres:// or postgresql:// to postgresql+psycopg://
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+psycopg://", 1)
            if v.startswith("postgresql://") and not v.startswith("postgresql+psycopg://"):
                return v.replace("postgresql://", "postgresql+psycopg://", 1)
            return v
        return v

    @field_validator("jwt_secret_key", mode="after")
    @classmethod
    def validate_jwt_secret(cls, v: str, info: Any) -> str:
        # Prevent insecure default keys in production
        env = info.data.get("app_env", "development")
        if env == "production" and v in ("change-me", "change-me-in-dev", ""):
            raise ValueError("JWT_SECRET_KEY must be set to a secure secret in production!")
        return v


settings = Settings()
