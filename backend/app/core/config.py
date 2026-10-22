from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "NetMind API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://netmind_app:netmind_app_local@127.0.0.1:5432/netmind"
    auth_allow_unsigned: bool = False
    nvidia_api_key: str | None = Field(default=None, validation_alias="NVIDIA_API_KEY")
    nvidia_model: str = "meta/muse-glimmer-30b"
    nvidia_timeout_s: float = Field(default=5, gt=0, le=30)
    nvidia_failure_threshold: int = Field(default=3, ge=1, le=10)
    nvidia_fixture_mode: bool = False

    model_config = SettingsConfigDict(env_prefix="NETMIND_", env_file=Path(__file__).resolve().parents[3] / ".env", extra="ignore", populate_by_name=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
