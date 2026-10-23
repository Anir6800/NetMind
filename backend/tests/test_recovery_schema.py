import pytest
from pydantic import ValidationError

from app.schemas.recovery import RecoveryPlan


def metadata() -> dict:
    return {"preconditions": ["link is down"], "expected_effect": "restore connectivity", "risk_level": "low", "rollback_action": "none", "expires_in_seconds": 60}


def test_plan_hash_is_canonical_and_changes_with_plan() -> None:
    plan = RecoveryPlan(incident_id=1, actions=[{"action": "restore_link", "link_id": "link-a-b", "expected_state": "down", "target_state": "up", "metadata": metadata()}]).with_hash()
    same = RecoveryPlan.model_validate_json(plan.model_dump_json()).with_hash()
    changed = plan.model_copy(update={"actions": [plan.actions[0].model_copy(update={"link_id": "link-b-c"})]}).with_hash()
    assert plan.plan_hash == same.plan_hash
    assert plan.plan_hash != changed.plan_hash


def test_unknown_action_is_rejected() -> None:
    with pytest.raises(ValidationError):
        RecoveryPlan(incident_id=1, actions=[{"action": "delete_everything", "metadata": metadata()}])
