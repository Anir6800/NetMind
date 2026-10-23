from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Approval


class ApprovalsRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create(self, *, plan_id: int, plan_hash: str, proposer_uid: str, approver_uid: str, expires_at: datetime, nonce: str, signature: str) -> Approval:
        approval = Approval(plan_id=plan_id, plan_hash=plan_hash, proposer_uid=proposer_uid, approver_uid=approver_uid, expires_at=expires_at, nonce=nonce, signature=signature)
        self.session.add(approval)
        self.session.flush()
        return approval

    def pending_by_nonce(self, nonce: str) -> Approval | None:
        return self.session.scalar(select(Approval).where(Approval.nonce == nonce).with_for_update())

    def consume(self, approval: Approval, consumed_at: datetime) -> Approval:
        approval.state = "approved"
        approval.consumed_at = consumed_at
        self.session.flush()
        return approval
