from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "NetMind API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://netmind_app:netmind_app_local@127.0.0.1:5432/netmind"

    model_config = SettingsConfigDict(env_prefix="NETMIND_", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
