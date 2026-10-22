"""Deterministic, allowlisted fault scenarios for the demo topology."""
from __future__ import annotations

import json
import time
import uuid
from collections.abc import Callable
from dataclasses import asdict, dataclass
from pathlib import Path

from topology.controller import Controller

SCENARIOS = {"link_down", "high_latency", "packet_loss", "congestion", "node_down"}


@dataclass
class FaultRecord:
    id: str
    type: str
    location: str
    started_wall_time: float
    started_monotonic_time: float
    seed: int
    ended_wall_time: float | None = None
    ended_monotonic_time: float | None = None


class ScenarioInjector:
    def __init__(
        self,
        controller: Controller,
        topology_path: Path,
        now: Callable[[], float] = time.time,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self.controller = controller
        self.now = now
        self.monotonic = monotonic
        topology = json.loads(topology_path.read_text())
        self.links = {link["id"]: link for link in topology["links"]}
        self.node_links: dict[str, list[str]] = {}
        for link in topology["links"]:
            for endpoint in (link["a"], link["b"]):
                self.node_links.setdefault(endpoint["node_id"], []).append(link["id"])
        self.active: dict[str, FaultRecord] = {}
        self.records: list[FaultRecord] = []

    def start(self, scenario_type: str, location: str, seed: int = 0) -> FaultRecord:
        if scenario_type not in SCENARIOS:
            raise ValueError("scenario is not supported")
        self._validate_location(scenario_type, location)
        fault_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"netmind:{seed}:{scenario_type}:{location}"))
        if fault_id in self.active:
            return self.active[fault_id]
        record = FaultRecord(fault_id, scenario_type, location, self.now(), self.monotonic(), seed)
        self._apply(record)
        self.active[fault_id] = record
        self.records.append(record)
        return record

    def stop(self, fault_id: str) -> FaultRecord:
        record = self.active.pop(fault_id, None)
        if record is None:
            raise ValueError("fault is not active")
        self._clear(record)
        record.ended_wall_time = self.now()
        record.ended_monotonic_time = self.monotonic()
        return record

    @staticmethod
    def incident_candidate(record: FaultRecord) -> dict:
        return {
            "fault_id": record.id,
            "type": record.type,
            "location": record.location,
            "state": "candidate",
            "source": "SIMULATED",
        }

    @staticmethod
    def ground_truth(record: FaultRecord) -> dict:
        return asdict(record)

    def _validate_location(self, scenario_type: str, location: str) -> None:
        valid = self.node_links if scenario_type == "node_down" else self.links
        if location not in valid:
            raise ValueError("scenario must target the stored demo topology")

    def _apply(self, record: FaultRecord) -> None:
        if record.type == "link_down":
            self.controller.execute("set_link_state", {"link_id": record.location, "state": "down"})
        elif record.type == "node_down":
            for link_id in self.node_links[record.location]:
                self.controller.execute("set_link_state", {"link_id": link_id, "state": "down"})
        else:
            endpoint = self.links[record.location]["a"]
            values = {
                "high_latency": {"delay_ms": 100},
                "packet_loss": {"loss_pct": 10},
                # shortcut: congestion uses an allowlisted rate shaper; upgrade when a typed iperf3 workload verb is approved.
                "congestion": {"rate_mbps": 10},
            }
            self.controller.execute("set_netem", {**endpoint, **values[record.type]})

    def _clear(self, record: FaultRecord) -> None:
        if record.type == "link_down":
            self.controller.execute("set_link_state", {"link_id": record.location, "state": "up"})
        elif record.type == "node_down":
            for link_id in self.node_links[record.location]:
                self.controller.execute("set_link_state", {"link_id": link_id, "state": "up"})
        else:
            endpoint = self.links[record.location]["a"]
            self.controller.execute("clear_netem", endpoint)
