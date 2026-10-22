from collections import deque
from copy import deepcopy


class TelemetryStore:
    def __init__(self, ttl_s: float = 15, retention: int = 120, alpha: float = 0.2) -> None:
        self.ttl_s, self.alpha = ttl_s, alpha
        self.samples: deque[dict] = deque(maxlen=retention)
        self.ewma: dict[str, float] = {}

    def ingest(self, sample: dict) -> dict:
        stored = deepcopy(sample)
        for key, value in sample.items():
            if key.endswith(("_ms", "_mbps", "_pct")) and isinstance(value, (int, float)):
                self.ewma[key] = value if key not in self.ewma else self.alpha * value + (1 - self.alpha) * self.ewma[key]
        stored["smoothed"] = dict(self.ewma)
        self.samples.append(stored)
        return stored

    def latest(self, now_monotonic: float) -> dict:
        if not self.samples:
            return {"state": "UNKNOWN", "sample": None}
        sample = self.samples[-1]
        state = "STALE" if now_monotonic - sample["monotonic_time"] > self.ttl_s else "FRESH"
        return {"state": state, "sample": sample}
