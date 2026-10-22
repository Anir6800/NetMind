import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "simulation-controller"))

from actions.allowlist import Allowlist
from actions.scenarios import ScenarioInjector
from topology.fallback import FallbackController

TOPOLOGY = ROOT / "data/topologies/demo_six_nodes.json"


@pytest.fixture
def injector() -> ScenarioInjector:
    controller = FallbackController(Allowlist(TOPOLOGY), TOPOLOGY)
    return ScenarioInjector(controller, TOPOLOGY, now=lambda: 10.0, monotonic=lambda: 20.0)


def test_link_down_produces_reproducible_candidate_and_ground_truth(injector: ScenarioInjector) -> None:
    record = injector.start("link_down", "router-a-router-b", seed=7)

    assert record.id == injector.start("link_down", "router-a-router-b", seed=7).id
    assert injector.incident_candidate(record) == {
        "fault_id": record.id,
        "type": "link_down",
        "location": "router-a-router-b",
        "state": "candidate",
        "source": "SIMULATED",
    }
    assert injector.ground_truth(record)["ended_wall_time"] is None
    assert injector.controller.telemetry()["paths"]["host-a:host-b"]["reachable"] is False

    stopped = injector.stop(record.id)
    assert stopped.ended_wall_time == 10.0
    assert injector.controller.telemetry()["paths"]["host-a:host-b"]["reachable"] is True


@pytest.mark.parametrize(
    ("scenario_type", "location"),
    [
        ("high_latency", "router-a-router-b"),
        ("packet_loss", "router-a-router-b"),
        ("congestion", "router-a-router-b"),
        ("node_down", "router-a"),
    ],
)
def test_all_demo_scenarios_start_and_stop(injector: ScenarioInjector, scenario_type: str, location: str) -> None:
    record = injector.start(scenario_type, location, seed=3)
    assert injector.ground_truth(record)["location"] == location
    assert injector.stop(record.id).ended_monotonic_time == 20.0


def test_scenario_rejects_non_demo_location(injector: ScenarioInjector) -> None:
    with pytest.raises(ValueError, match="stored demo topology"):
        injector.start("link_down", "internet", seed=1)
