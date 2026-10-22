from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.schemas.network import Topology
from app.services.networks import NetworksService

router = APIRouter(prefix="/networks", tags=["networks"])


class NetworkResponse(BaseModel):
    id: int
    name: str
    topology_version: str


class TopologyResponse(BaseModel):
    topology: Topology
    source: Literal["SIMULATED"]
    last_updated: datetime


@router.get("", response_model=list[NetworkResponse])
def list_networks(session: Annotated[Session, Depends(get_session)]) -> list[NetworkResponse]:
    return NetworksService(session).list()


@router.get("/{network_id}/topology", response_model=TopologyResponse)
def get_topology(network_id: int, session: Annotated[Session, Depends(get_session)]) -> TopologyResponse:
    result = NetworksService(session).topology(network_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Network not found")
    topology, last_updated = result
    return TopologyResponse(topology=topology, source="SIMULATED", last_updated=last_updated)
