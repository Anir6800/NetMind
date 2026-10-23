from pathlib import Path

from actions.allowlist import Allowlist
from actions.executor import Executor
from topology.fallback import FallbackController

TOPOLOGY = Path(__file__).parents[2] / "data/topologies/demo_six_nodes.json"


def test_executor_reconciles_active_action_after_restart() -> None:
    controller = FallbackController(Allowlist(TOPOLOGY), TOPOLOGY)
    executor = Executor(controller, now=lambda: 0)
    action = executor.execute(1, "run-1", "set_link_state", {"link_id": "router-a-router-b", "state": "up"}, "set_link_state", {"link_id": "router-a-router-b", "state": "down"})
    assert executor.execute(1, "run-1", "set_link_state", {"link_id": "router-a-router-b", "state": "up"}, "set_link_state", {"link_id": "router-a-router-b", "state": "down"}) is action
    assert executor.reconcile()[0].state == "rolled_back"
