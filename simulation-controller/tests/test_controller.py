import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "simulation-controller"))

from actions.allowlist import Allowlist
from topology.controller import Controller


@pytest.fixture
def controller() -> Controller:
    return Controller(Allowlist(ROOT / "data/topologies/demo_six_nodes.json"))


def test_allowed_operation_is_idempotent(controller: Controller) -> None:
    params = {"link_id": "router-a-router-b", "state": "down"}
    assert controller.execute("set_link_state", params)["changed"] is True
    assert controller.execute("set_link_state", params)["changed"] is False


def test_controller_rejects_arbitrary_operation(controller: Controller) -> None:
    with pytest.raises(ValueError, match="allowlisted"):
        controller.execute("run_shell", {"command": "whoami"})


def test_controller_rejects_unknown_interface(controller: Controller) -> None:
    with pytest.raises(ValueError, match="known interface"):
        controller.execute("clear_netem", {"node_id": "router-a", "interface_id": "missing"})


def test_controller_never_uses_shell_true() -> None:
    forbidden = "shell" + "=True"
    assert forbidden not in "\n".join(path.read_text() for path in (ROOT / "simulation-controller").rglob("*.py"))
