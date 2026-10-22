import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "simulation-controller"))

from actions.allowlist import Allowlist
from topology.controller import Controller
from topology.fallback import FallbackController

TOPOLOGY = ROOT / "data/topologies/demo_six_nodes.json"


@pytest.fixture(params=["measured", "simulated"])
def adapter(request) -> Controller:
    allowlist = Allowlist(TOPOLOGY)
    return Controller(allowlist) if request.param == "measured" else FallbackController(allowlist, TOPOLOGY)


def test_controller_contract(adapter: Controller) -> None:
    params = {"link_id": "router-a-router-b", "state": "down"}
    assert adapter.execute("set_link_state", params)["ok"] is True
    assert adapter.execute("set_link_state", params)["changed"] is False
    assert adapter.telemetry()["source"] in {"MEASURED", "SIMULATED"}


def test_simulated_paths_recompute_after_link_failure() -> None:
    controller = FallbackController(Allowlist(TOPOLOGY), TOPOLOGY)
    assert controller.telemetry()["paths"]["host-a:host-b"]["reachable"] is True
    controller.execute("set_link_state", {"link_id": "router-a-router-b", "state": "down"})
    assert controller.telemetry()["paths"]["host-a:host-b"] == {"reachable": False, "nodes": []}
