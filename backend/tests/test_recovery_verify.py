from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.models import Approval, Base, Incident, Network
from app.db.models import RecoveryPlan as StoredPlan
from app.schemas.recovery import RecoveryPlan
from app.services.recovery.execution import RecoveryExecutionService
from app.services.recovery.verify import Baseline, Probe, RecoveryVerifier


class Controller:
    def __init__(self) -> None: self.calls: list[tuple[str, dict]] = []
    def execute(self, verb: str, params: dict) -> dict:
        self.calls.append((verb, params)); return {"ok": True}


def setup() -> tuple[Session, Controller, int, int]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = Session(engine)
    network = Network(name="demo", topology_version="v1"); session.add(network); session.flush()
    incident = Incident(network_id=network.id, title="fault", severity="warning"); session.add(incident); session.flush()
    plan = StoredPlan(incident_id=incident.id, summary="restore", state="approved"); session.add(plan); session.flush()
    session.add(Approval(plan_id=plan.id, approver_uid="approver", proposer_uid="proposer", plan_hash="a" * 64, expires_at=datetime(2027, 1, 1, tzinfo=timezone.utc), nonce=f"nonce-{plan.id}", signature="signature", state="approved", consumed_at=datetime(2026, 1, 1, tzinfo=timezone.utc)))
    session.commit()
    return session, Controller(), network.id, plan.id


def action_plan() -> RecoveryPlan:
    return RecoveryPlan(incident_id=1, actions=[{"action": "restore_link", "link_id": "router-a-router-b", "expected_state": "down", "target_state": "up", "metadata": {"preconditions": ["down"], "expected_effect": "up", "risk_level": "low", "rollback_action": "restore_link", "expires_in_seconds": 60}}]).with_hash()


def test_verification_resolves_after_consecutive_healthy_probes() -> None:
    session, controller, network_id, plan_id = setup(); start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    execution = RecoveryExecutionService(session, controller).start(network_id=network_id, plan_id=plan_id, plan=action_plan(), idempotency_key="verify-ok", now=start)
    probes = [Probe(start + timedelta(seconds=offset), 12, 0) for offset in (1, 2, 3)]
    result = RecoveryVerifier(session, RecoveryExecutionService(session, controller)).verify(execution_id=execution.id, baseline=Baseline(rtt_ms=10), probes=probes, injected_at=start, detected_at=start + timedelta(milliseconds=500))
    assert result.verified and result.mttd_ms == 500 and result.mttr_ms == 3000
    assert session.get(StoredPlan, plan_id).state == "executed"
    assert session.get(Incident, 1).state == "resolved"


def test_failed_verification_rolls_back_and_marks_plan_failed() -> None:
    session, controller, network_id, plan_id = setup(); start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    execution = RecoveryExecutionService(session, controller).start(network_id=network_id, plan_id=plan_id, plan=action_plan(), idempotency_key="verify-fail", now=start)
    result = RecoveryVerifier(session, RecoveryExecutionService(session, controller)).verify(execution_id=execution.id, baseline=Baseline(rtt_ms=10), probes=[Probe(start + timedelta(seconds=1), 50, 10)], injected_at=start, detected_at=start + timedelta(milliseconds=500))
    assert not result.verified
    assert session.get(StoredPlan, plan_id).state == "failed"
    assert controller.calls[-1] == ("set_link_state", {"link_id": "router-a-router-b", "state": "down"})
