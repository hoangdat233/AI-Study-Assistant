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
        env_file=str(_ENV_FILE), env_file_encoding="utf-8", extra="ignore"
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

    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        description="List of allowed CORS origins for FastAPI middleware",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        if isinstance(v, list):
            return v
        return ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("jwt_secret_key", mode="after")
    @classmethod
    def validate_jwt_secret(cls, v: str, info: Any) -> str:
        # Prevent insecure default keys in production
        env = info.data.get("app_env", "development")
        if env == "production" and v in ("change-me", "change-me-in-dev", ""):
            raise ValueError("JWT_SECRET_KEY must be set to a secure secret in production!")
        return v


settings = Settings()
