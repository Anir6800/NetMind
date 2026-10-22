from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.db.models import Base
from app.repositories.audit import AuditRepository
from app.services.incidents.timeline import IncidentTimeline


def test_timeline_orders_events_and_proves_provenance() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        timeline = IncidentTimeline(AuditRepository(session))
        start = datetime(2026, 1, 1, tzinfo=UTC)
        timeline.detection(7, {"loss_pct": 20}, start)
        timeline.diagnosis_request(7, {"question": "why"}, start + timedelta(seconds=1))
        timeline.approval(7, {"state": "approved"}, start + timedelta(seconds=2))
        timeline.action_transition(7, {"from": "pending", "to": "executed"}, start + timedelta(seconds=3))

        repository = AuditRepository(session)
        assert [event.event_type for event in repository.timeline()] == ["detection", "diagnosis_request", "approval", "action_transition"]
        assert repository.verify_chain() == (True, None)


def test_hash_verification_detects_tampered_record() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        repository = AuditRepository(session)
        repository.append("detection", {"incident_id": 1})
        event = repository.append("approval", {"incident_id": 1})
        session.execute(text("UPDATE audit_events SET payload = :payload WHERE id = :id"), {"payload": '{"incident_id":999}', "id": event.id})
        assert repository.verify_chain() == (False, event.id)
