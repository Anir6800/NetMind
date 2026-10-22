from app.core.config import Settings
from app.integrations.gemini_client import Diagnosis, GeminiClient


def test_missing_key_returns_labelled_offline_diagnosis() -> None:
    diagnosis = GeminiClient(Settings(gemini_api_key=None)).diagnose({"loss_pct": 20})

    assert diagnosis.source == "OFFLINE_FIXTURE"
    assert diagnosis.offline is True
    assert "Gemini was not used" in diagnosis.summary


def test_fixture_mode_is_deterministic() -> None:
    client = GeminiClient(Settings(gemini_fixture_mode=True))
    first = client.diagnose({"rtt_ms": 100})
    second = client.diagnose({"rtt_ms": 100})

    assert first.model_dump(exclude={"latency_ms"}) == second.model_dump(exclude={"latency_ms"})


def test_retries_then_opens_circuit_without_exposing_key(caplog) -> None:
    calls = 0

    def fail(_: dict) -> Diagnosis:
        nonlocal calls
        calls += 1
        raise TimeoutError

    client = GeminiClient(Settings(gemini_api_key="secret", gemini_failure_threshold=2), requester=fail)
    client.diagnose({})
    client.diagnose({})
    diagnosis = client.diagnose({})

    assert calls == 4
    assert client.circuit_open is True
    assert diagnosis.source == "OFFLINE_FIXTURE"
    assert "secret" not in caplog.text
