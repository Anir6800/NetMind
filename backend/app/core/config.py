from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "NetMind API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://netmind_app:netmind_app_local@127.0.0.1:5432/netmind"
    auth_allow_unsigned: bool = False
    gemini_api_key: str | None = Field(default=None, validation_alias=AliasChoices("GEMINI_API_KEY", "NETMIND_GEMINI_API_KEY"))
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_s: float = Field(default=5, gt=0, le=30)
    gemini_failure_threshold: int = Field(default=3, ge=1, le=10)
    gemini_fixture_mode: bool = False

    model_config = SettingsConfigDict(env_prefix="NETMIND_", extra="ignore", populate_by_name=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
