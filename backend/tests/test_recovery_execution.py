from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.models import Approval, Base, Incident, Network
from app.db.models import RecoveryPlan as StoredPlan
from app.repositories.audit import AuditRepository
from app.schemas.recovery import RecoveryPlan
from app.services.recovery.execution import ExecutionError, RecoveryExecutionService


class FakeController:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []
    def execute(self, verb: str, params: dict) -> dict:
        self.calls.append((verb, params))
        return {"ok": True}


def setup() -> tuple[Session, FakeController, int, int]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = Session(engine)
    network = Network(name="demo", topology_version="v1")
    session.add(network); session.flush()
    incident = Incident(network_id=network.id, title="fault", severity="warning")
    session.add(incident); session.flush()
    plan = StoredPlan(incident_id=incident.id, summary="restore", state="approved")
    session.add(plan); session.commit()
    session.add(Approval(plan_id=plan.id, approver_uid="approver", proposer_uid="proposer", plan_hash="a" * 64, expires_at=datetime(2027, 1, 1, tzinfo=timezone.utc), nonce="nonce", signature="signature", state="approved", consumed_at=datetime(2026, 1, 1, tzinfo=timezone.utc)))
    session.commit()
    return session, FakeController(), network.id, plan.id


def plan() -> RecoveryPlan:
    return RecoveryPlan(incident_id=1, actions=[{"action": "restore_link", "link_id": "router-a-router-b", "expected_state": "down", "target_state": "up", "metadata": {"preconditions": ["down"], "expected_effect": "up", "risk_level": "low", "rollback_action": "restore_link", "expires_in_seconds": 60}}]).with_hash()


def test_execution_is_idempotent_and_auto_rolls_back() -> None:
    session, controller, network_id, plan_id = setup()
    service = RecoveryExecutionService(session, controller)
    started = service.start(network_id=network_id, plan_id=plan_id, plan=plan(), idempotency_key="key-1", now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert service.start(network_id=network_id, plan_id=plan_id, plan=plan(), idempotency_key="key-1").id == started.id
    completed = service.confirm(started.id, verified=False)
    assert completed.state == "rolled_back"
    assert controller.calls == [("set_link_state", {"link_id": "router-a-router-b", "state": "up"}), ("set_link_state", {"link_id": "router-a-router-b", "state": "down"})]
    assert [event.event_type for event in AuditRepository(session).timeline()] == ["recovery_execution_started", "recovery_execution_rolled_back"]


def test_network_lock_and_restart_reconciliation() -> None:
    session, controller, network_id, plan_id = setup()
    service = RecoveryExecutionService(session, controller)
    service.start(network_id=network_id, plan_id=plan_id, plan=plan(), idempotency_key="key-1")
    with pytest.raises(ExecutionError, match="active"):
        service.start(network_id=network_id, plan_id=plan_id, plan=plan(), idempotency_key="key-2")
    restarted = RecoveryExecutionService(session, controller).reconcile()
    assert restarted[0].state == "rolled_back"
