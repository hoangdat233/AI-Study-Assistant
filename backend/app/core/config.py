from pathlib import Path

from pydantic import Field
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

    database_url: str = Field(default="postgresql+psycopg://db/ai_study_assistant")

    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60


settings = Settings()
