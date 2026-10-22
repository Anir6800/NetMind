from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.services.incidents import IncidentsService

router = APIRouter(prefix="/incidents", tags=["incidents"])


class IncidentResponse(BaseModel):
    id: int
    network_id: int
    title: str
    severity: str
    state: str


@router.get("", response_model=list[IncidentResponse])
def list_incidents(session: Annotated[Session, Depends(get_session)], network_id: int | None = None, state: str | None = None, limit: Annotated[int, Query(ge=1, le=100)] = 50, offset: Annotated[int, Query(ge=0)] = 0) -> list[IncidentResponse]:
    return IncidentsService(session).list(network_id, state, limit, offset)


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: int, session: Annotated[Session, Depends(get_session)]) -> IncidentResponse:
    incident = IncidentsService(session).get(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident
