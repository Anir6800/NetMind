"""Server-only Gemini diagnosis adapter with deterministic offline behavior."""
from __future__ import annotations

import json
import logging
import time
from collections.abc import Callable

from pydantic import BaseModel, Field
from tenacity import Retrying, retry_if_exception_type, stop_after_attempt, wait_fixed

from app.core.config import Settings

logger = logging.getLogger(__name__)


class Diagnosis(BaseModel):
    source: str
    summary: str
    probable_cause: str
    confidence: float = Field(ge=0, le=1)
    offline: bool
    latency_ms: int


class GeminiClient:
    def __init__(self, settings: Settings, requester: Callable[[dict], Diagnosis] | None = None) -> None:
        self.settings = settings
        self.requester = requester
        self.failures = 0
        self.circuit_open = False

    def diagnose(self, evidence: dict) -> Diagnosis:
        started = time.monotonic()
        if self.settings.gemini_fixture_mode:
            return self._fixture("fixture_mode", started)
        if not self.settings.gemini_api_key:
            return self._fixture("missing_api_key", started)
        if self.circuit_open:
            return self._fixture("circuit_open", started)
        try:
            diagnosis = Retrying(
                stop=stop_after_attempt(2),
                wait=wait_fixed(0),
                retry=retry_if_exception_type(Exception),
                reraise=True,
            )(self.requester or self._request, evidence)
            self.failures = 0
            self._log("gemini", started, "ok")
            return diagnosis.model_copy(update={"latency_ms": self._latency(started), "offline": False, "source": "GEMINI"})
        except Exception:  # noqa: BLE001 - provider exceptions must never break offline diagnosis.
            self.failures += 1
            self.circuit_open = self.failures >= self.settings.gemini_failure_threshold
            return self._fixture("request_failed", started)

    def _request(self, evidence: dict) -> Diagnosis:
        from google import genai
        from google.genai import types

        client = genai.Client(
            api_key=self.settings.gemini_api_key,
            http_options=types.HttpOptions(timeout=round(self.settings.gemini_timeout_s * 1000)),
        )
        response = client.models.generate_content(
            model=self.settings.gemini_model,
            contents=canonical_prompt(evidence),
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
                response_schema=Diagnosis,
            ),
        )
        return Diagnosis.model_validate(response.parsed or json.loads(response.text))

    def _fixture(self, reason: str, started: float) -> Diagnosis:
        self._log("offline_fixture", started, reason)
        return Diagnosis(
            source="OFFLINE_FIXTURE",
            summary="Offline deterministic diagnosis; Gemini was not used.",
            probable_cause="Insufficient live model availability; inspect source telemetry.",
            confidence=0.0,
            offline=True,
            latency_ms=self._latency(started),
        )

    def _log(self, mode: str, started: float, outcome: str) -> None:
        logger.info("gemini_diagnosis", extra={"mode": mode, "model": self.settings.gemini_model, "outcome": outcome, "latency_ms": self._latency(started)})

    @staticmethod
    def _latency(started: float) -> int:
        return round((time.monotonic() - started) * 1000)


def canonical_prompt(evidence: dict) -> str:
    return "Diagnose this network incident using only the supplied evidence: " + json.dumps(evidence, sort_keys=True, separators=(",", ":"))
