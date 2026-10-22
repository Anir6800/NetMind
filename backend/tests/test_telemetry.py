from app.services.telemetry import TelemetryStore


def test_telemetry_store_marks_missing_as_unknown_and_stale() -> None:
    store = TelemetryStore(ttl_s=5, retention=2, alpha=0.5)
    assert store.latest(10) == {"state": "UNKNOWN", "sample": None}
    stored = store.ingest({"source": "SIMULATED", "monotonic_time": 10, "wall_time": 100, "rtt_ms": 8, "loss_pct": None})
    assert stored["smoothed"]["rtt_ms"] == 8
    assert store.latest(16)["state"] == "STALE"


def test_telemetry_store_uses_ewma_and_ring_retention() -> None:
    store = TelemetryStore(retention=1, alpha=0.5)
    store.ingest({"source": "MEASURED", "monotonic_time": 1, "wall_time": 1, "rtt_ms": 10})
    second = store.ingest({"source": "MEASURED", "monotonic_time": 2, "wall_time": 2, "rtt_ms": 20})
    assert second["smoothed"]["rtt_ms"] == 15
    assert len(store.samples) == 1
