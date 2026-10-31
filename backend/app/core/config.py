from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "NetMind API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://netmind_app:netmind_app_local@127.0.0.1:5432/netmind"
    auth_allow_unsigned: bool = False
    approval_hmac_key: str = "local-development-key-change-me"
    gemini_api_key: str | None = Field(default=None, validation_alias="GEMINI_API_KEY")
    gemini_model: str = "gemini-2.0-flash"
    gemini_timeout_s: float = Field(default=10, gt=0, le=30)
    nvidia_api_key: str | None = Field(default=None, validation_alias="NVIDIA_API_KEY")
    nvidia_model: str = "nvidia/nemotron-3-ultra-550b-a55b"
    nvidia_fallback_model: str = "meta/muse-glimmer-30b"
    nvidia_timeout_s: float = Field(default=5, gt=0, le=30)
    nvidia_rate_limit_rpm: int = Field(default=40, ge=1, le=40)
    nvidia_failure_threshold: int = Field(default=3, ge=1, le=10)
    nvidia_fixture_mode: bool = False

    @field_validator("database_url")
    @classmethod
    def postgres_driver(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return "postgresql+psycopg://" + value[len("postgres://"):]
        if value.startswith("postgresql://"):
            return "postgresql+psycopg://" + value[len("postgresql://"):]
        return value

    model_config = SettingsConfigDict(env_prefix="NETMIND_", env_file=Path(__file__).resolve().parents[3] / ".env", extra="ignore", populate_by_name=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
