import hashlib
import json
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuditEvent

GENESIS_HASH = "0" * 64


def canonical_json(value: dict) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def event_hash(prev_hash: str, event_type: str, payload: str, created_at: datetime) -> str:
    timestamp = created_at.replace(tzinfo=created_at.tzinfo or UTC).isoformat()
    record = canonical_json({"created_at": timestamp, "event_type": event_type, "payload": json.loads(payload)})
    return hashlib.sha256((prev_hash + record).encode()).hexdigest()


class AuditRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def append(self, event_type: str, payload: dict, created_at: datetime | None = None) -> AuditEvent:
        timestamp = created_at or datetime.now(UTC)
        payload_json = canonical_json(payload)
        previous = self.session.scalar(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(1))
        prev_hash = previous.record_hash if previous else GENESIS_HASH
        event = AuditEvent(event_type=event_type, payload=payload_json, created_at=timestamp, prev_hash=prev_hash, record_hash=event_hash(prev_hash, event_type, payload_json, timestamp))
        self.session.add(event)
        self.session.flush()
        return event

    def timeline(self) -> list[AuditEvent]:
        return list(self.session.scalars(select(AuditEvent).order_by(AuditEvent.id).execution_options(populate_existing=True)))

    def verify_chain(self) -> tuple[bool, int | None]:
        previous = GENESIS_HASH
        for event in self.timeline():
            expected = event_hash(previous, event.event_type, event.payload, event.created_at)
            if event.prev_hash != previous or event.record_hash != expected:
                return False, event.id
            previous = event.record_hash
        return True, None
