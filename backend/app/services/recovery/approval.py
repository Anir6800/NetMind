"""Authenticated, one-time human approval transactions."""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.repositories.approvals import ApprovalsRepository

logger = logging.getLogger(__name__)


class ApprovalError(ValueError):
    pass


class ApprovalService:
    def __init__(self, session: Session, signing_key: str) -> None:
        if not signing_key:
            raise ValueError("approval signing key is required")
        self.session = session
        self.repository = ApprovalsRepository(session)
        self.key = signing_key.encode()

    def issue(self, *, plan_id: int, plan_hash: str, proposer_uid: str, approver_uid: str, approver_role: str, ttl_seconds: int = 300, now: datetime | None = None):
        if approver_role not in {"approver", "admin"}:
            raise ApprovalError("approver role is not authorized")
        if proposer_uid == approver_uid:
            raise ApprovalError("separation of duties violation")
        if not 1 <= ttl_seconds <= 3600:
            raise ApprovalError("approval TTL is out of bounds")
        issued = _utc(now or datetime.now(timezone.utc))
        expires = issued + timedelta(seconds=ttl_seconds)
        nonce = secrets.token_urlsafe(32)
        signature = self._sign(plan_hash, approver_uid, expires, nonce)
        approval = self.repository.create(plan_id=plan_id, plan_hash=plan_hash, proposer_uid=proposer_uid, approver_uid=approver_uid, expires_at=expires, nonce=nonce, signature=signature)
        self.session.commit()
        return approval

    def approve(self, *, nonce: str, plan_hash: str, approver_uid: str, approver_role: str, now: datetime | None = None):
        current = _utc(now or datetime.now(timezone.utc))
        try:
            approval = self.repository.pending_by_nonce(nonce)
            if approval is None:
                raise ApprovalError("approval nonce not found")
            if approval.consumed_at is not None:
                raise ApprovalError("approval already consumed")
            if approver_role not in {"approver", "admin"} or approver_uid != approval.approver_uid:
                raise ApprovalError("approver role or identity is not authorized")
            if approver_uid == approval.proposer_uid:
                raise ApprovalError("separation of duties violation")
            if current >= _utc(approval.expires_at):
                raise ApprovalError("approval expired")
            if approval.plan_hash != plan_hash:
                raise ApprovalError("plan hash mismatch")
            if not hmac.compare_digest(approval.signature, self._sign(approval.plan_hash, approval.approver_uid, approval.expires_at, approval.nonce)):
                raise ApprovalError("approval signature invalid")
            approved = self.repository.consume(approval, current)
            self.session.commit()
            return approved
        except ApprovalError as error:
            self.session.rollback()
            logger.warning("approval_rejected", extra={"nonce": nonce, "reason": str(error)})
            raise

    def _sign(self, plan_hash: str, approver_uid: str, expires_at: datetime, nonce: str) -> str:
        payload = f"{plan_hash}:{approver_uid}:{_utc(expires_at).isoformat()}:{nonce}".encode()
        return hmac.new(self.key, payload, hashlib.sha256).hexdigest()


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
