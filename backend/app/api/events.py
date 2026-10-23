import json
from time import sleep
from typing import Annotated, Iterator

from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuditEvent
from app.db.session import get_session

router = APIRouter(prefix="/events", tags=["events"])

def _events(session: Session, after_id: int) -> list[AuditEvent]:
    return list(session.scalars(select(AuditEvent).where(AuditEvent.id > after_id).order_by(AuditEvent.id)))

def _event(event: AuditEvent) -> dict:
    return {"id": event.id, "type": event.event_type, "payload": json.loads(event.payload), "created_at": event.created_at.isoformat()}

@router.get("/poll")
def poll_events(session: Annotated[Session, Depends(get_session)], last_event_id: int = Query(default=0, ge=0), limit: int = Query(default=50, ge=1, le=100)) -> list[dict]:
    return [_event(event) for event in _events(session, last_event_id)[:limit]]

@router.get("")
def stream_events(session: Annotated[Session, Depends(get_session)], last_event_id: int = Query(default=0, ge=0), last_event_header: Annotated[str | None, Header(alias="Last-Event-ID")] = None) -> StreamingResponse:
    cursor = int(last_event_header or last_event_id or 0)
    def generate() -> Iterator[str]:
        nonlocal cursor
        while True:
            events = _events(session, cursor)
            if events:
                for event in events:
                    cursor = event.id
                    yield f"id: {event.id}\ndata: {json.dumps(_event(event))}\n\n"
            else:
                yield ": keep-alive\n\n"
            session.expire_all()
            sleep(1)
    return StreamingResponse(generate(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
