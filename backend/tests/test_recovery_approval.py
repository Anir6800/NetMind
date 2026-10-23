from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.models import Base
from app.services.recovery.approval import ApprovalError, ApprovalService


def service() -> tuple[Session, ApprovalService]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = Session(engine)
    return session, ApprovalService(session, "test-backend-key")


def issue(service: ApprovalService, **kwargs):
    return service.issue(plan_id=1, plan_hash="a" * 64, proposer_uid="proposer", approver_uid="approver", approver_role="approver", now=datetime(2026, 1, 1, tzinfo=timezone.utc), **kwargs)


def test_approval_binds_hash_and_is_consumed_once() -> None:
    session, approvals = service()
    record = issue(approvals)
    approved = approvals.approve(nonce=record.nonce, plan_hash="a" * 64, approver_uid="approver", approver_role="approver", now=datetime(2026, 1, 1, 0, 1, tzinfo=timezone.utc))
    assert approved.consumed_at is not None
    with pytest.raises(ApprovalError, match="already consumed"):
        approvals.approve(nonce=record.nonce, plan_hash="a" * 64, approver_uid="approver", approver_role="approver")
    session.close()


@pytest.mark.parametrize("kwargs, expected", [
    ({"plan_hash": "b" * 64}, "plan hash mismatch"),
    ({"approver_role": "viewer"}, "approver role"),
])
def test_tampered_or_wrong_role_is_rejected(kwargs: dict, expected: str) -> None:
    session, approvals = service()
    record = issue(approvals)
    with pytest.raises(ApprovalError, match=expected):
        approvals.approve(nonce=record.nonce, plan_hash=kwargs.get("plan_hash", "a" * 64), approver_uid="approver", approver_role=kwargs.get("approver_role", "approver"), now=datetime(2026, 1, 1, 0, 0, 1, tzinfo=timezone.utc))
    session.close()


def test_expired_approval_is_rejected() -> None:
    session, approvals = service()
    record = issue(approvals, ttl_seconds=1)
    with pytest.raises(ApprovalError, match="expired"):
        approvals.approve(nonce=record.nonce, plan_hash="a" * 64, approver_uid="approver", approver_role="approver", now=datetime(2026, 1, 1, 0, 0, 2, tzinfo=timezone.utc))
    session.close()


def test_proposer_cannot_approve() -> None:
    session, approvals = service()
    record = approvals.issue(plan_id=1, plan_hash="a" * 64, proposer_uid="same", approver_uid="other", approver_role="approver")
    with pytest.raises(ApprovalError):
        approvals.approve(nonce=record.nonce, plan_hash="a" * 64, approver_uid="same", approver_role="approver")
    session.close()
