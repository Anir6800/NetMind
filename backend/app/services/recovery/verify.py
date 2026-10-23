"""Post-action connectivity verification with bounded rollback on failure."""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.models import Incident, RecoveryExecution, RecoveryPlan
from app.repositories.audit import AuditRepository
from app.services.recovery.execution import RecoveryExecutionService


@dataclass(frozen=True)
class Baseline:
    rtt_ms: float
    loss_threshold_pct: float = 1.0


@dataclass(frozen=True)
class Probe:
    captured_at: datetime
    rtt_ms: float | None
    loss_pct: float | None


@dataclass(frozen=True)
class VerificationResult:
    verified: bool
    consecutive_samples: int
    mttd_ms: int
    mttr_ms: int


class RecoveryVerifier:
    def __init__(self, session: Session, execution: RecoveryExecutionService) -> None:
        self.session = session
        self.execution = execution
        self.audit = AuditRepository(session)

    def verify(self, *, execution_id: int, baseline: Baseline, probes: list[Probe], injected_at: datetime, detected_at: datetime, required_consecutive: int = 3, window_seconds: int = 30) -> VerificationResult:
        if required_consecutive < 1 or window_seconds < 1:
            raise ValueError("verification bounds are invalid")
        record = self.session.get(RecoveryExecution, execution_id)
        if record is None:
            raise ValueError("execution not found")
        streak: list[Probe] = []
        verified_at = probes[-1].captured_at if probes else datetime.now(timezone.utc)
        for probe in probes:
            if self._healthy(probe, baseline):
                streak.append(probe)
                if len(streak) > required_consecutive:
                    streak.pop(0)
                if len(streak) == required_consecutive and (_utc(streak[-1].captured_at) - _utc(streak[0].captured_at)).total_seconds() <= window_seconds:
                    verified_at = streak[-1].captured_at
                    break
            else:
                streak.clear()
        verified = len(streak) == required_consecutive
        injected = _utc(injected_at)
        result = VerificationResult(verified, len(streak), max(0, round((_utc(detected_at) - injected).total_seconds() * 1000)), max(0, round((_utc(verified_at) - injected).total_seconds() * 1000)))
        record.mttd_ms, record.mttr_ms = result.mttd_ms, result.mttr_ms
        record.verification = json.dumps({"verified": verified, "consecutive_samples": result.consecutive_samples, "baseline_rtt_ms": baseline.rtt_ms, "loss_threshold_pct": baseline.loss_threshold_pct}, sort_keys=True)
        completed = self.execution.confirm(execution_id, verified, _utc(verified_at))
        plan = self.session.get(RecoveryPlan, completed.plan_id)
        incident = self.session.get(Incident, plan.incident_id) if plan else None
        if verified:
            if plan: plan.state = "executed"
            if incident: incident.state = "resolved"
            event = "recovery_verified"
        else:
            if plan: plan.state = "failed"
            if incident: incident.state = "open"
            event = "recovery_verification_failed"
        self.audit.append(event, {"execution_id": execution_id, "verified": verified, "mttd_ms": result.mttd_ms, "mttr_ms": result.mttr_ms})
        self.session.commit()
        return result

    @staticmethod
    def _healthy(probe: Probe, baseline: Baseline) -> bool:
        return probe.loss_pct is not None and probe.rtt_ms is not None and probe.loss_pct <= baseline.loss_threshold_pct and probe.rtt_ms <= baseline.rtt_ms * 1.2


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
