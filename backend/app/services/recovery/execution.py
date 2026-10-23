"""Persisted, commit-confirmed recovery execution; no planning occurs here."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Approval, Network, RecoveryExecution
from app.db.models import RecoveryPlan as StoredPlan
from app.repositories.audit import AuditRepository
from app.schemas.recovery import RecoveryPlan, RestoreLink


class Controller(Protocol):
    def execute(self, verb: str, params: dict) -> dict: ...


class ExecutionError(ValueError):
    pass


class RecoveryExecutionService:
    def __init__(self, session: Session, controller: Controller) -> None:
        self.session = session
        self.controller = controller
        self.audit = AuditRepository(session)

    def start(self, *, network_id: int, plan_id: int, plan: RecoveryPlan, idempotency_key: str, confirm_within_seconds: int = 30, now: datetime | None = None) -> RecoveryExecution:
        current = _utc(now or datetime.now(timezone.utc))
        existing = self.session.scalar(select(RecoveryExecution).where(RecoveryExecution.idempotency_key == idempotency_key))
        if existing:
            return existing
        network = self.session.scalar(select(Network).where(Network.id == network_id).with_for_update())
        stored_plan = self.session.get(StoredPlan, plan_id)
        approval = self.session.scalar(select(Approval).where(Approval.plan_id == plan_id, Approval.state == "approved", Approval.consumed_at.is_not(None)))
        if network is None or stored_plan is None or stored_plan.state != "approved" or approval is None:
            raise ExecutionError("plan is not human-approved for execution")
        active = self.session.scalar(select(RecoveryExecution).where(RecoveryExecution.network_id == network_id, RecoveryExecution.state == "executing").with_for_update())
        if active:
            raise ExecutionError("network already has an active recovery action")
        if not 1 <= confirm_within_seconds <= 300:
            raise ExecutionError("confirmation timeout is out of bounds")
        action, rollback = _commands(plan)
        record = RecoveryExecution(network_id=network_id, plan_id=plan_id, idempotency_key=idempotency_key, state="executing", action=json.dumps(action, sort_keys=True), rollback=json.dumps(rollback, sort_keys=True), deadline=current + timedelta(seconds=confirm_within_seconds))
        self.session.add(record)
        self.session.flush()
        self.controller.execute(action["verb"], action["params"])
        self.audit.append("recovery_execution_started", {"network_id": network_id, "plan_id": plan_id, "idempotency_key": idempotency_key})
        self.session.commit()
        return record

    def confirm(self, execution_id: int, verified: bool, now: datetime | None = None) -> RecoveryExecution:
        record = self.session.get(RecoveryExecution, execution_id)
        if record is None:
            raise ExecutionError("execution not found")
        if record.state != "executing":
            return record
        current = _utc(now or datetime.now(timezone.utc))
        if verified and current < _utc(record.deadline):
            record.state, record.completed_at = "confirmed", current
            event = "recovery_execution_confirmed"
        else:
            self._rollback(record, current)
            event = "recovery_execution_rolled_back"
        self.audit.append(event, {"execution_id": record.id, "network_id": record.network_id})
        self.session.commit()
        return record

    def reconcile(self, now: datetime | None = None) -> list[RecoveryExecution]:
        current = _utc(now or datetime.now(timezone.utc))
        records = list(self.session.scalars(select(RecoveryExecution).where(RecoveryExecution.state == "executing").with_for_update()))
        for record in records:
            self._rollback(record, current)
            self.audit.append("recovery_execution_reconciled", {"execution_id": record.id, "network_id": record.network_id})
        self.session.commit()
        return records

    def _rollback(self, record: RecoveryExecution, current: datetime) -> None:
        rollback = json.loads(record.rollback)
        self.controller.execute(rollback["verb"], rollback["params"])
        record.state, record.completed_at = "rolled_back", current


def _commands(plan: RecoveryPlan) -> tuple[dict, dict]:
    if len(plan.actions) != 1 or not isinstance(plan.actions[0], RestoreLink):
        raise ExecutionError("only one approved restore_link action can execute")
    action = plan.actions[0]
    return ({"verb": "set_link_state", "params": {"link_id": action.link_id, "state": "up"}}, {"verb": "set_link_state", "params": {"link_id": action.link_id, "state": "down"}})


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
