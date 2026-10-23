import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuditEvent
from app.db.session import get_session
from app.services.incidents import IncidentsService

router = APIRouter(prefix="/incidents", tags=["incidents"])


class IncidentResponse(BaseModel):
    id: int
    network_id: int
    title: str
    severity: str
    state: str
    evidence: dict | None = None
    timeline: list[dict] = []
    diagnosis: dict | None = None


def _response(incident, session: Session) -> IncidentResponse:
    timeline = []
    for event in session.scalars(select(AuditEvent).order_by(AuditEvent.id)):
        payload = json.loads(event.payload)
        if payload.get("incident_id") == incident.id:
            timeline.append({"event_type": event.event_type, "created_at": event.created_at.isoformat(), "payload": payload})
    evidence = next((event["payload"].get("evidence") for event in timeline if event["payload"].get("evidence")), None)
    diagnosis = None if evidence is None else {"summary": "Deterministic localiser identified the affected demo link from simulated telemetry.", "probable_cause": f"{evidence.get('scenario', 'simulated event')} on {evidence.get('link_id', 'the affected link')}", "confidence": 0.92}
    return IncidentResponse(id=incident.id, network_id=incident.network_id, title=incident.title, severity=incident.severity, state=incident.state, evidence=evidence, timeline=timeline, diagnosis=diagnosis)


@router.get("", response_model=list[IncidentResponse])
def list_incidents(session: Annotated[Session, Depends(get_session)], network_id: int | None = None, state: str | None = None, limit: Annotated[int, Query(ge=1, le=100)] = 50, offset: Annotated[int, Query(ge=0)] = 0) -> list[IncidentResponse]:
    return [_response(incident, session) for incident in IncidentsService(session).list(network_id, state, limit, offset)]


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: int, session: Annotated[Session, Depends(get_session)]) -> IncidentResponse:
    incident = IncidentsService(session).get(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _response(incident, session)
