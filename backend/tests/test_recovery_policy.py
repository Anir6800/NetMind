import random
from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.schemas.network import Topology
from app.schemas.recovery import RecoveryPlan
from app.services.recovery.policy import PolicyContext, RecoveryPolicy

NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)
TOPOLOGY = Topology.model_validate({"version": "v1", "addressing_plan": "demo", "nodes": [{"id": "host-a", "type": "host", "interfaces": [{"id": "eth0", "address": "10.0.0.1/24"}]}, {"id": "router", "type": "router", "interfaces": [{"id": "eth0", "address": "10.0.0.2/24"}, {"id": "eth1", "address": "10.0.0.3/24"}]}, {"id": "host-b", "type": "host", "interfaces": [{"id": "eth0", "address": "10.0.0.4/24"}]}], "links": [{"id": "link-a-r", "a": {"node_id": "host-a", "interface_id": "eth0"}, "b": {"node_id": "router", "interface_id": "eth0"}, "capacity_mbps": 100, "delay_ms": 1, "state": "down"}, {"id": "link-r-b", "a": {"node_id": "router", "interface_id": "eth1"}, "b": {"node_id": "host-b", "interface_id": "eth0"}, "capacity_mbps": 100, "delay_ms": 1, "state": "up"}], "expected_baseline_paths": [{"source_host_id": "host-a", "destination_host_id": "host-b", "link_ids": ["link-a-r", "link-r-b"]}]})


def meta() -> dict:
    return {"preconditions": ["checked"], "expected_effect": "safe change", "risk_level": "low", "rollback_action": "none", "expires_in_seconds": 60}


def plan(action: dict) -> RecoveryPlan:
    return RecoveryPlan(incident_id=1, actions=[action]).with_hash()


def context(**overrides) -> PolicyContext:
    values = {"now": NOW, "plan_created_at": NOW, "permissions": frozenset({"restore_link", "reroute_via", "throttle_flow", "clear_throttle"}), "telemetry_at": NOW}
    values.update(overrides)
    return PolicyContext(**values)


@pytest.mark.parametrize("change", [
    {"permissions": frozenset()}, {"rollback_ready": False}, {"cooldown_until": NOW + timedelta(seconds=1)},
    {"telemetry_at": None}, {"telemetry_at": NOW - timedelta(seconds=31)}, {"blast_radius_limit": 1},
    {"plan_hash": "0" * 64},
])
def test_policy_denies_invalid_context(change: dict) -> None:
    action = {"action": "restore_link", "link_id": "link-a-r", "expected_state": "down", "target_state": "up", "metadata": meta()}
    decision = RecoveryPolicy().validate(plan(action) if "plan_hash" not in change else plan(action).model_copy(update={"plan_hash": change.pop("plan_hash")}), TOPOLOGY, context(**change))
    assert not decision.allowed


@pytest.mark.parametrize("action", [
    {"action": "restore_link", "link_id": "missing", "expected_state": "down", "target_state": "up", "metadata": meta()},
    {"action": "restore_link", "link_id": "link-r-b", "expected_state": "down", "target_state": "up", "metadata": meta()},
    {"action": "reroute_via", "source": "host-a", "destination": "host-b", "alternate_path": ["missing", "link-r-b"], "metadata": meta()},
    {"action": "reroute_via", "source": "host-a", "destination": "host-b", "alternate_path": ["link-r-b", "link-a-r"], "metadata": meta()},
    {"action": "throttle_flow", "flow_id": "flow-1", "rate_mbps": 1001, "metadata": meta()},
    {"action": "restore_link", "link_id": "link-a-r", "expected_state": "down", "target_state": "up", "metadata": {**meta(), "expires_in_seconds": 1}},
    {"action": "reroute_via", "source": "host-a", "destination": "host-b", "alternate_path": ["link-a-r"], "metadata": meta()},
    {"action": "reroute_via", "source": "host-a", "destination": "host-b", "alternate_path": ["link-a-r", "link-a-r"], "metadata": meta()},
])
def test_invalid_what_if_is_denied(action: dict) -> None:
    try:
        candidate = plan(action)
    except ValidationError:
        return
    decision = RecoveryPolicy().validate(candidate, TOPOLOGY, context(plan_created_at=NOW - timedelta(seconds=2)) if action["metadata"].get("expires_in_seconds") == 1 else context())
    assert not decision.allowed


def test_valid_restore_has_no_executor_surface() -> None:
    action = {"action": "restore_link", "link_id": "link-a-r", "expected_state": "down", "target_state": "up", "metadata": meta()}
    assert RecoveryPolicy().validate(plan(action), TOPOLOGY, context()).allowed


def test_parameter_fuzz_never_allows_invalid_rates() -> None:
    for rate in [random.uniform(-100, 1100) for _ in range(100)]:
        action = {"action": "throttle_flow", "flow_id": "flow-1", "rate_mbps": rate, "metadata": meta()}
        try:
            candidate = plan(action)
        except ValidationError:
            assert not 0 < rate <= 1000
            continue
        assert RecoveryPolicy().validate(candidate, TOPOLOGY, context()).allowed == (0 < rate <= 1000)
