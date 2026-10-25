"""Server-only NVIDIA OpenAI-compatible diagnosis adapter."""
from __future__ import annotations

import json
import logging
import time
from collections import deque
from collections.abc import Callable
from functools import lru_cache
from threading import Lock

from pydantic import BaseModel, Field
from tenacity import Retrying, retry_if_exception_type, stop_after_attempt, wait_fixed

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class Diagnosis(BaseModel):
    source: str
    summary: str
    probable_cause: str
    confidence: float = Field(ge=0, le=1)
    offline: bool
    latency_ms: int


class ProviderDiagnosis(BaseModel):
    summary: str
    probable_cause: str
    confidence: float = Field(ge=0, le=1)


class AiUnavailable(RuntimeError):
    """The live provider is not configured, is failing, or its circuit is open."""


class RateLimiter:
    def __init__(self, limit: int, now: Callable[[], float] = time.monotonic) -> None:
        self.limit = limit
        self.now = now
        self.calls: deque[float] = deque()
        self.lock = Lock()

    def acquire(self) -> None:
        with self.lock:
            now = self.now()
            while self.calls and now - self.calls[0] >= 60:
                self.calls.popleft()
            if len(self.calls) >= self.limit:
                raise RuntimeError("NVIDIA rate limit of 40 requests per minute reached")
            self.calls.append(now)


class NvidiaClient:
    def __init__(
        self,
        settings: Settings,
        requester: Callable[[dict, str], Diagnosis] | None = None,
        text_requester: Callable[[str, str, int, float], str] | None = None,
    ) -> None:
        self.settings = settings
        self.requester = requester
        self.text_requester = text_requester
        self.last_model: str | None = None
        self.failures = 0
        self.circuit_open = False
        self.rate_limiter = RateLimiter(settings.nvidia_rate_limit_rpm)

    def diagnose(self, evidence: dict) -> Diagnosis:
        started = time.monotonic()
        if self.settings.nvidia_fixture_mode:
            return self._fixture("fixture_mode", started)
        if not self.settings.nvidia_api_key:
            return self._fixture("missing_api_key", started)
        if self.circuit_open:
            return self._fixture("circuit_open", started)
        try:
            diagnosis = self._diagnose_with_models(evidence)
            self.failures = 0
            self._log("nvidia", started, "ok")
            return diagnosis.model_copy(update={"latency_ms": self._latency(started), "offline": False, "source": "NVIDIA"})
        except Exception:  # noqa: BLE001 - provider exceptions must never break offline diagnosis.
            self.failures += 1
            self.circuit_open = self.failures >= self.settings.nvidia_failure_threshold
            return self._fixture("request_failed", started)

    def mode(self) -> tuple[str, str]:
        """LIVE when a key is configured, fixture mode is off and the circuit is closed."""
        if self.settings.nvidia_fixture_mode:
            return "LOCAL_RULES", "NETMIND_NVIDIA_FIXTURE_MODE=true"
        if not self.settings.nvidia_api_key:
            return "LOCAL_RULES", "no NVIDIA_API_KEY configured"
        if self.circuit_open:
            return "LOCAL_RULES", f"circuit open after {self.failures} failed calls"
        return "LIVE", "key configured"

    def complete_json(self, instruction: str, *, max_tokens: int = 400, timeout_s: float | None = None) -> str:
        """One JSON completion with a retry budget of 3 attempts across primary and fallback models.

        Raises AiUnavailable when not LIVE or every attempt fails; the caller then uses its
        labelled local fallback. Model output is returned as text and must be validated by the caller.
        """
        mode, reason = self.mode()
        if mode != "LIVE":
            raise AiUnavailable(reason)
        started = time.monotonic()
        attempts = 0
        last_error: Exception | None = None
        for model in (self.settings.nvidia_model, self.settings.nvidia_fallback_model):
            for _ in range(2):
                if attempts >= 3:
                    break
                attempts += 1
                try:
                    text = (self.text_requester or self._complete)(instruction, model, max_tokens, timeout_s or self.settings.nvidia_timeout_s)
                    self.failures = 0
                    self.last_model = model
                    self._log("nvidia", started, "ok")
                    return text
                except Exception as error:  # noqa: BLE001 - any provider failure falls back to local rules.
                    last_error = error
        self.failures += 1
        self.circuit_open = self.failures >= self.settings.nvidia_failure_threshold
        self._log("offline_fixture", started, "request_failed")
        raise AiUnavailable(f"NVIDIA request failed ({type(last_error).__name__})") from last_error

    def _complete(self, instruction: str, model: str, max_tokens: int, timeout_s: float) -> str:
        from openai import OpenAI

        self.rate_limiter.acquire()
        client = OpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=self.settings.nvidia_api_key, timeout=timeout_s, max_retries=0)
        completion = client.chat.completions.create(model=model, messages=[{"role": "user", "content": instruction}], temperature=0.1, max_tokens=max_tokens, extra_body={"chat_template_kwargs": {"enable_thinking": False}})
        return completion.choices[0].message.content or ""

    def _diagnose_with_models(self, evidence: dict) -> Diagnosis:
        last_error: Exception | None = None
        for model in (self.settings.nvidia_model, self.settings.nvidia_fallback_model):
            try:
                return Retrying(stop=stop_after_attempt(2), wait=wait_fixed(0), retry=retry_if_exception_type(Exception), reraise=True)(self.requester or self._request, evidence, model)
            except Exception as error:  # noqa: BLE001 - try the configured safe fallback before fixture mode.
                last_error = error
        raise RuntimeError("all NVIDIA models failed") from last_error

    def _request(self, evidence: dict, model: str) -> Diagnosis:
        from openai import OpenAI

        self.rate_limiter.acquire()
        client = OpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=self.settings.nvidia_api_key, timeout=self.settings.nvidia_timeout_s)
        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": canonical_prompt(evidence)}],
            temperature=0.1,
            top_p=0.95,
            max_tokens=512,
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )
        diagnosis = ProviderDiagnosis.model_validate(json.loads(completion.choices[0].message.content or "{}"))
        return Diagnosis(source="NVIDIA", offline=False, latency_ms=0, **diagnosis.model_dump())

    def _fixture(self, reason: str, started: float) -> Diagnosis:
        self._log("offline_fixture", started, reason)
        return Diagnosis(source="OFFLINE_FIXTURE", summary="Offline deterministic diagnosis; NVIDIA was not used.", probable_cause="Insufficient live model availability; inspect source telemetry.", confidence=0.0, offline=True, latency_ms=self._latency(started))

    def _log(self, mode: str, started: float, outcome: str) -> None:
        logger.info("nvidia_diagnosis", extra={"mode": mode, "model": self.settings.nvidia_model, "outcome": outcome, "latency_ms": self._latency(started)})

    @staticmethod
    def _latency(started: float) -> int:
        return round((time.monotonic() - started) * 1000)


def canonical_prompt(evidence: dict) -> str:
    return "Return JSON matching summary, probable_cause, and confidence (0 to 1). Diagnose using only: " + json.dumps(evidence, sort_keys=True, separators=(",", ":"))


@lru_cache
def get_ai_client() -> NvidiaClient:
    """Process-wide client so the circuit breaker and rate limiter persist between requests."""
    return NvidiaClient(get_settings())
