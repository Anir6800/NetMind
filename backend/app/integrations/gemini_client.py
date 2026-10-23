"""Server-only Gemini diagnosis adapter with deterministic fallback."""
from __future__ import annotations

import json
import time
from collections.abc import Callable

import httpx

from app.core.config import Settings
from app.integrations.nvidia_client import Diagnosis, canonical_prompt


class GeminiClient:
    def __init__(self, settings: Settings, requester: Callable[[dict], Diagnosis] | None = None) -> None:
        self.settings, self.requester = settings, requester

    def diagnose(self, evidence: dict) -> Diagnosis:
        started = time.monotonic()
        if not self.settings.gemini_api_key:
            return self._offline(started)
        try:
            diagnosis = (self.requester or self._request)(evidence)
            return diagnosis.model_copy(update={"source": "GEMINI", "offline": False, "latency_ms": round((time.monotonic() - started) * 1000)})
        except Exception:  # noqa: BLE001 - provider failure must not permit unsafe behavior
            return self._offline(started)

    def _request(self, evidence: dict) -> Diagnosis:
        response = httpx.post(f"https://generativelanguage.googleapis.com/v1beta/models/{self.settings.gemini_model}:generateContent", headers={"x-goog-api-key": self.settings.gemini_api_key or ""}, json={"contents": [{"parts": [{"text": canonical_prompt(evidence)}]}], "generationConfig": {"responseMimeType": "application/json"}}, timeout=self.settings.gemini_timeout_s)
        response.raise_for_status()
        raw = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw)
        return Diagnosis(source="GEMINI", offline=False, latency_ms=0, **parsed)

    @staticmethod
    def _offline(started: float) -> Diagnosis:
        return Diagnosis(source="OFFLINE_FIXTURE", summary="Offline deterministic diagnosis; Gemini was not used.", probable_cause="Cloud diagnosis is unavailable; inspect source telemetry.", confidence=0.0, offline=True, latency_ms=round((time.monotonic() - started) * 1000))
