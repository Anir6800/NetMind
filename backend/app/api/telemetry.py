from datetime import UTC, datetime
from time import monotonic, time
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.telemetry import TelemetryStore

router = APIRouter(prefix="/telemetry", tags=["telemetry"])
store = TelemetryStore()
# Windows runs the lab without Mininet, so show a clearly labelled local sample on startup.
store.ingest({"source": "SIMULATED", "monotonic_time": monotonic(), "wall_time": time(), "rtt_ms": 14, "loss_pct": 0.2, "jitter_ms": 2.1, "throughput_mbps": 940})


class TelemetryMetric(BaseModel):
    name: str
    value: float | None
    unit: str
    source: Literal["MEASURED", "SIMULATED"]
    sampled_at: datetime
    ttl_seconds: float
    state: Literal["FRESH", "STALE"]


class TelemetryResponse(BaseModel):
    metrics: list[TelemetryMetric]


_METRICS = {"rtt_ms": ("Round-trip time", "ms"), "loss_pct": ("Packet loss", "%"), "jitter_ms": ("Jitter", "ms"), "throughput_mbps": ("Throughput", "Mbps")}


@router.get("/latest", response_model=TelemetryResponse)
def latest_telemetry() -> TelemetryResponse:
    result = store.latest(monotonic())
    latest = result["sample"]
    if latest is None:
        return TelemetryResponse(metrics=[])
    sampled_at = datetime.fromtimestamp(float(latest["wall_time"]), UTC)
    return TelemetryResponse(metrics=[TelemetryMetric(name=name, value=latest.get(key), unit=unit, source=latest["source"], sampled_at=sampled_at, ttl_seconds=store.ttl_s, state=result["state"]) for key, (name, unit) in _METRICS.items()])
