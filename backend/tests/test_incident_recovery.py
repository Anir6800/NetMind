from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.models import Base, Incident, Network, RecoveryPlan as StoredPlan
from app.repositories.audit import AuditRepository
from app.schemas.network import Topology
from app.schemas.recovery import RecoveryPlan
from app.services.ai.diagnosis import DiagnosisService, LocalizerOutput
from app.services.incidents.detector import IncidentState, transition
from app.services.recovery.approval import ApprovalService
from app.services.recovery.execution import RecoveryExecutionService
from app.services.recovery.policy import PolicyContext, RecoveryPolicy
from app.services.recovery.verify import Baseline, Probe, RecoveryVerifier

NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)


class Controller:
    def __init__(self) -> None: self.calls: list[tuple[str, dict]] = []
    def execute(self, verb: str, params: dict) -> dict: self.calls.append((verb, params)); return {"ok": True}


def topology() -> Topology:
    return Topology.model_validate({"version": "v1", "addressing_plan": "demo", "nodes": [{"id": "host-a", "type": "host", "interfaces": [{"id": "eth0", "address": "10.0.0.1/24"}]}, {"id": "router", "type": "router", "interfaces": [{"id": "eth0", "address": "10.0.0.2/24"}, {"id": "eth1", "address": "10.0.0.3/24"}]}, {"id": "host-b", "type": "host", "interfaces": [{"id": "eth0", "address": "10.0.0.4/24"}]}], "links": [{"id": "router-a-router-b", "a": {"node_id": "host-a", "interface_id": "eth0"}, "b": {"node_id": "router", "interface_id": "eth0"}, "capacity_mbps": 100, "delay_ms": 1, "state": "down"}, {"id": "router-b-host-b", "a": {"node_id": "router", "interface_id": "eth1"}, "b": {"node_id": "host-b", "interface_id": "eth0"}, "capacity_mbps": 100, "delay_ms": 1, "state": "up"}], "expected_baseline_paths": [{"source_host_id": "host-a", "destination_host_id": "host-b", "link_ids": ["router-a-router-b", "router-b-host-b"]}]})


def setup() -> tuple[Session, Controller, Incident, StoredPlan, RecoveryPlan]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool); Base.metadata.create_all(engine)
    session = Session(engine); network = Network(name="demo", topology_version="v1"); session.add(network); session.flush()
    incident = Incident(network_id=network.id, title="Injected link fault", severity="critical"); session.add(incident); session.flush()
    audit = AuditRepository(session); audit.append("detection", {"incident_id": incident.id, "evidence": {"link_id": "router-a-router-b", "loss_pct": 100}}, NOW)
    evidence = {"audit:1": {"link_id": "router-a-router-b", "loss_pct": 100}}
    diagnosis = DiagnosisService.validate({"probable_cause": "Injected link is down.", "confidence": 0.99, "evidence_ids": ["audit:1"], "candidate_link_ids": ["router-a-router-b"], "alternative_hypotheses": [], "uncertainty_notes": "Controller state confirms the link fault.", "recommended_action_ref": "restore_link"}, LocalizerOutput(["router-a-router-b"], [], ["audit:1"]), evidence)
    audit.append("diagnosis", {"incident_id": incident.id, "cause": diagnosis.diagnosis.probable_cause}, NOW + timedelta(milliseconds=100))
    plan = RecoveryPlan(incident_id=incident.id, actions=[{"action": "restore_link", "link_id": "router-a-router-b", "expected_state": "down", "target_state": "up", "metadata": {"preconditions": ["topology reports down"], "expected_effect": "restore connectivity", "risk_level": "low", "rollback_action": "restore_link", "expires_in_seconds": 60}}]).with_hash()
    assert RecoveryPolicy().validate(plan, topology(), PolicyContext(now=NOW, plan_created_at=NOW, permissions=frozenset({"restore_link"}), telemetry_at=NOW)).allowed
    stored = StoredPlan(incident_id=incident.id, summary=diagnosis.diagnosis.probable_cause); session.add(stored); session.flush()
    audit.append("recovery_proposed", {"incident_id": incident.id, "plan_hash": plan.plan_hash}, NOW + timedelta(milliseconds=200)); session.commit()
    return session, Controller(), incident, stored, plan


def approve(session: Session, stored: StoredPlan, plan: RecoveryPlan) -> None:
    approvals = ApprovalService(session, "test-key")
    record = approvals.issue(plan_id=stored.id, plan_hash=plan.plan_hash or "", proposer_uid="operator", approver_uid="approver", approver_role="approver", now=NOW)
    approvals.approve(nonce=record.nonce, plan_hash=plan.plan_hash or "", approver_uid="approver", approver_role="approver", now=NOW + timedelta(seconds=1))
    stored.state = "approved"; AuditRepository(session).append("approval", {"incident_id": stored.incident_id, "plan_id": stored.id}, NOW + timedelta(seconds=1)); session.commit()


def test_seeded_incident_lifecycle_resolves_end_to_end() -> None:
    session, controller, incident, stored, plan = setup(); approve(session, stored, plan)
    execution = RecoveryExecutionService(session, controller).start(network_id=incident.network_id, plan_id=stored.id, plan=plan, idempotency_key="seeded-recovery", now=NOW + timedelta(seconds=2))
    result = RecoveryVerifier(session, RecoveryExecutionService(session, controller)).verify(execution_id=execution.id, baseline=Baseline(rtt_ms=10), probes=[Probe(NOW + timedelta(seconds=offset), 11, 0) for offset in (3, 4, 5)], injected_at=NOW, detected_at=NOW + timedelta(milliseconds=100))
    assert result.verified and session.get(Incident, incident.id).state == "resolved" and session.get(StoredPlan, stored.id).state == "executed"
    assert [event.event_type for event in AuditRepository(session).timeline()] == ["detection", "diagnosis", "recovery_proposed", "approval", "recovery_execution_started", "recovery_execution_confirmed", "recovery_verified"]


def test_failed_verification_rolls_back_and_illegal_transition_is_rejected() -> None:
    session, controller, incident, stored, plan = setup(); approve(session, stored, plan)
    execution = RecoveryExecutionService(session, controller).start(network_id=incident.network_id, plan_id=stored.id, plan=plan, idempotency_key="failed-recovery", now=NOW + timedelta(seconds=2))
    result = RecoveryVerifier(session, RecoveryExecutionService(session, controller)).verify(execution_id=execution.id, baseline=Baseline(rtt_ms=10), probes=[Probe(NOW + timedelta(seconds=3), 50, 30)], injected_at=NOW, detected_at=NOW + timedelta(milliseconds=100))
    assert not result.verified and session.get(StoredPlan, stored.id).state == "failed" and controller.calls[-1][1]["state"] == "down"
    with pytest.raises(ValueError, match="illegal"):
        transition(IncidentState.RESOLVED, IncidentState.OPEN)
