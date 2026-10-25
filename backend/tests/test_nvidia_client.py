from app.core.config import Settings
from app.integrations.nvidia_client import Diagnosis, NvidiaClient, RateLimiter


def test_missing_key_returns_labelled_offline_diagnosis() -> None:
    diagnosis = NvidiaClient(Settings(nvidia_api_key=None)).diagnose({"loss_pct": 20})

    assert diagnosis.source == "OFFLINE_FIXTURE"
    assert diagnosis.offline is True
    assert "NVIDIA was not used" in diagnosis.summary


def test_fixture_mode_is_deterministic() -> None:
    client = NvidiaClient(Settings(nvidia_fixture_mode=True))
    first = client.diagnose({"rtt_ms": 100})
    second = client.diagnose({"rtt_ms": 100})

    assert first.model_dump(exclude={"latency_ms"}) == second.model_dump(exclude={"latency_ms"})


def test_mode_is_explicit() -> None:
    assert NvidiaClient(Settings(nvidia_api_key="secret", nvidia_fixture_mode=True)).mode()[0] == "LOCAL_RULES"
    assert NvidiaClient(Settings(nvidia_api_key=None, nvidia_fixture_mode=False)).mode() == ("LOCAL_RULES", "no NVIDIA_API_KEY configured")
    assert NvidiaClient(Settings(nvidia_api_key="secret", nvidia_fixture_mode=False)).mode()[0] == "LIVE"


def test_retries_then_opens_circuit_without_exposing_key(caplog) -> None:
    calls = 0

    def fail(_: dict, __: str) -> Diagnosis:
        nonlocal calls
        calls += 1
        raise TimeoutError

    client = NvidiaClient(Settings(nvidia_api_key="secret", nvidia_failure_threshold=2, nvidia_fixture_mode=False), requester=fail)
    client.diagnose({})
    client.diagnose({})
    diagnosis = client.diagnose({})

    assert calls == 8
    assert client.circuit_open is True
    assert diagnosis.source == "OFFLINE_FIXTURE"
    assert "secret" not in caplog.text


def test_uses_meta_fallback_after_primary_fails() -> None:
    def request(_: dict, model: str) -> Diagnosis:
        if model.startswith("nvidia/"):
            raise TimeoutError
        return Diagnosis(source="test", summary="fallback", probable_cause="test", confidence=1, offline=False, latency_ms=0)

    diagnosis = NvidiaClient(Settings(nvidia_api_key="secret", nvidia_fixture_mode=False), requester=request).diagnose({})
    assert diagnosis.source == "NVIDIA"
    assert diagnosis.summary == "fallback"


def test_rate_limiter_never_exceeds_40_requests_per_minute() -> None:
    limiter = RateLimiter(40, now=lambda: 1)
    for _ in range(40):
        limiter.acquire()
    try:
        limiter.acquire()
    except RuntimeError as error:
        assert "40 requests per minute" in str(error)
    else:
        raise AssertionError("expected the 40 RPM limiter to reject request 41")
