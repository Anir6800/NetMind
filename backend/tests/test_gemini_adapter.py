import pytest

from app.core.config import Settings
from app.integrations.gemini_client import GeminiClient
from app.integrations.nvidia_client import Diagnosis


def test_missing_key_returns_valid_labelled_offline_diagnosis() -> None:
    diagnosis = GeminiClient(Settings(gemini_api_key=None)).diagnose({"loss_pct": 20})
    assert diagnosis.source == "OFFLINE_FIXTURE" and diagnosis.offline is True
    assert "Gemini was not used" in diagnosis.summary


def test_online_response_uses_valid_schema_without_actions() -> None:
    client = GeminiClient(Settings(gemini_api_key="test"), requester=lambda _: Diagnosis(source="test", summary="Evidence shows loss.", probable_cause="link loss", confidence=0.9, offline=False, latency_ms=0))
    diagnosis = client.diagnose({"loss_pct": 20})
    assert diagnosis.source == "GEMINI" and diagnosis.offline is False and diagnosis.confidence == 0.9


@pytest.mark.parametrize("evidence", [{"incident": index, "loss_pct": index} for index in range(10)])
def test_offline_golden_set_stays_schema_valid_and_read_only(evidence: dict) -> None:
    diagnosis = GeminiClient(Settings(gemini_api_key=None)).diagnose(evidence)
    assert diagnosis.source == "OFFLINE_FIXTURE" and diagnosis.offline is True and diagnosis.confidence == 0
