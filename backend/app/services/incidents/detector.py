"""Deterministic telemetry rules for the versioned demo topology."""
from __future__ import annotations

import json
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path


class IncidentState(StrEnum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


LEGAL_TRANSITIONS = {
    IncidentState.OPEN: {IncidentState.ACKNOWLEDGED, IncidentState.RESOLVED},
    IncidentState.ACKNOWLEDGED: {IncidentState.RESOLVED},
    IncidentState.RESOLVED: set(),
}


def transition(state: IncidentState, target: IncidentState) -> IncidentState:
    if target not in LEGAL_TRANSITIONS[state]:
        raise ValueError(f"illegal incident transition: {state} -> {target}")
    return target


@dataclass
class DetectedIncident:
    key: str
    kind: str
    location: str
    severity_score: int
    evidence: dict
    state: IncidentState = IncidentState.OPEN


class IncidentDetector:
    def __init__(
        self,
        topology_path: Path,
        consecutive_breaches: int = 3,
        flap_damping_s: float = 30,
        loss_raise_pct: float = 10,
        loss_clear_pct: float = 5,
        latency_raise_ms: float = 100,
        latency_clear_ms: float = 70,
    ) -> None:
        topology = json.loads(topology_path.read_text())
        self.paths = topology["expected_baseline_paths"]
        self.consecutive_breaches = consecutive_breaches
        self.flap_damping_s = flap_damping_s
        self.thresholds = {"loss": (loss_raise_pct, loss_clear_pct), "latency": (latency_raise_ms, latency_clear_ms)}
        self.breaches: dict[str, int] = {}
        self.clears: dict[str, int] = {}
        self.active: dict[str, DetectedIncident] = {}
        self.last_resolved: dict[str, float] = {}

    def evaluate(self, sample: dict) -> list[DetectedIncident]:
        now = sample["monotonic_time"]
        signals = self._signals(sample)
        emitted: list[DetectedIncident] = []
        seen = {key for key, _, _, _ in signals}
        for key, kind, location, value in signals:
            if self._is_breach(kind, value):
                self.clears[key] = 0
                self.breaches[key] = self.breaches.get(key, 0) + 1
                if key not in self.active and self.breaches[key] >= self.consecutive_breaches and now - self.last_resolved.get(key, -float("inf")) >= self.flap_damping_s:
                    incident = DetectedIncident(key, kind, location, self._severity(kind, value), self._evidence(sample, value))
                    self.active[key] = incident
                    emitted.append(incident)
            elif key in self.active and self._is_clear(kind, value):
                self.clears[key] = self.clears.get(key, 0) + 1
                if self.clears[key] >= self.consecutive_breaches:
                    self.active[key].state = transition(self.active[key].state, IncidentState.RESOLVED)
                    self.last_resolved[key] = now
                    del self.active[key]
            else:
                self.breaches[key] = 0
        for key, incident in list(self.active.items()):
            if key not in seen:
                self.clears[key] = self.clears.get(key, 0) + 1
                if self.clears[key] >= self.consecutive_breaches:
                    incident.state = transition(incident.state, IncidentState.RESOLVED)
                    self.last_resolved[key] = now
                    del self.active[key]
        return emitted

    def _signals(self, sample: dict) -> list[tuple[str, str, str, float]]:
        down_links = {link_id for link_id, state in sample.get("link_states", {}).items() if state == "down"}
        signals = [(f"link_down:{link_id}", "link_down", link_id, 1.0) for link_id in sorted(down_links)]
        impacted_hosts = {
            path["destination_host_id"]
            for path in self.paths
            if down_links.intersection(path["link_ids"])
        }
        signals.extend((f"host_unreachable:{host}", "host_unreachable", host, 1.0) for host in sample.get("unreachable_nodes", []) if host not in impacted_hosts)
        link_id = sample.get("link_id")
        if link_id and sample.get("loss_pct") is not None:
            signals.append((f"loss:{link_id}", "loss", link_id, float(sample["loss_pct"])))
        if link_id and sample.get("rtt_ms") is not None:
            signals.append((f"latency:{link_id}", "latency", link_id, float(sample["rtt_ms"])))
        return signals

    def _is_breach(self, kind: str, value: float) -> bool:
        return kind in {"link_down", "host_unreachable"} or value >= self.thresholds[kind][0]

    def _is_clear(self, kind: str, value: float) -> bool:
        return kind in {"link_down", "host_unreachable"} or value <= self.thresholds[kind][1]

    def _severity(self, kind: str, value: float) -> int:
        if kind in {"link_down", "host_unreachable"}:
            return 100
        threshold = self.thresholds[kind][0]
        return min(100, round(50 + 50 * value / threshold))

    @staticmethod
    def _evidence(sample: dict, value: float) -> dict:
        return {"source": sample["source"], "monotonic_time": sample["monotonic_time"], "metric_value": value}
