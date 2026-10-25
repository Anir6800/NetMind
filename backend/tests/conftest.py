import pytest

from app.core.config import get_settings
from app.integrations.nvidia_client import get_ai_client


@pytest.fixture(autouse=True)
def no_live_ai(monkeypatch):
    # Settings read the repo .env, which may hold a real key: tests never call the live provider.
    monkeypatch.setenv("NETMIND_NVIDIA_FIXTURE_MODE", "true")
    get_settings.cache_clear()
    get_ai_client.cache_clear()
    yield
    get_settings.cache_clear()
    get_ai_client.cache_clear()
