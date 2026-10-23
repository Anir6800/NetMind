from pathlib import Path

import pytest

from actions.allowlist import Allowlist
from actions.executor import Executor
from actions.rollback import rollback
from topology.fallback import FallbackController

TOPOLOGY = Path(__file__).parents[2] / "data/topologies/demo_six_nodes.json"


def test_executor_reconciles_active_action_after_restart() -> None:
    controller = FallbackController(Allowlist(TOPOLOGY), TOPOLOGY)
    executor = Executor(controller, now=lambda: 0)
    action = executor.execute(1, "run-1", "set_link_state", {"link_id": "router-a-router-b", "state": "up"}, "set_link_state", {"link_id": "router-a-router-b", "state": "down"})
    assert executor.execute(1, "run-1", "set_link_state", {"link_id": "router-a-router-b", "state": "up"}, "set_link_state", {"link_id": "router-a-router-b", "state": "down"}) is action
    assert executor.reconcile()[0].state == "rolled_back"


def test_rollback_rejects_unbounded_controller_commands() -> None:
    controller = FallbackController(Allowlist(TOPOLOGY), TOPOLOGY)
    rollback(controller, "set_link_state", {"link_id": "router-a-router-b", "state": "down"})
    with pytest.raises(ValueError, match="bounded"):
        rollback(controller, "replace_route", {})
