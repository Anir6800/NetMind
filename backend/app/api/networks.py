from typing import Annotated

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


@router.get("", response_model=list[NetworkResponse])
def list_networks(session: Annotated[Session, Depends(get_session)]) -> list[NetworkResponse]:
    return NetworksService(session).list()


@router.get("/{network_id}/topology", response_model=Topology)
def get_topology(network_id: int, session: Annotated[Session, Depends(get_session)]) -> Topology:
    topology = NetworksService(session).topology(network_id)
    if topology is None:
        raise HTTPException(status_code=404, detail="Network not found")
    return topology
