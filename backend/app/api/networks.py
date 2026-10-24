from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.schemas.network import Topology
from app.services.networks import NetworksService

router = APIRouter(prefix="/networks", tags=["networks"])


class NetworkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    topology_version: str


class TopologyResponse(BaseModel):
    topology: Topology
    source: Literal["SIMULATED"]
    last_updated: datetime


class NetworkDocument(BaseModel):
    name: str
    topology: Topology


class GenerateRequest(BaseModel):
    name: str
    category: str = "campus"
    device_count: int = Field(default=50, ge=6, le=50)
    protocol: Literal["static", "rip", "ospf"] = "ospf"
    prompt: str = ""


class GeneratedNetwork(BaseModel):
    network: NetworkResponse
    topology: Topology
    source: Literal["SIMULATED_AI_PLANNER"] = "SIMULATED_AI_PLANNER"


@router.get("", response_model=list[NetworkResponse])
def list_networks(session: Annotated[Session, Depends(get_session)]) -> list[NetworkResponse]:
    return NetworksService(session).list()


@router.post("", response_model=NetworkResponse, status_code=201)
def create_network(request: NetworkDocument, session: Annotated[Session, Depends(get_session)]) -> NetworkResponse:
    return NetworksService(session).create(request.name, request.topology)


@router.post("/generate", response_model=GeneratedNetwork, status_code=201)
def generate_network(request: GenerateRequest, session: Annotated[Session, Depends(get_session)]) -> GeneratedNetwork:
    network, topology = NetworksService(session).generate(request.name, request.device_count, request.category, request.protocol, request.prompt)
    return GeneratedNetwork(network=network, topology=topology)


@router.put("/{network_id}", response_model=NetworkResponse)
def update_network(network_id: int, request: NetworkDocument, session: Annotated[Session, Depends(get_session)]) -> NetworkResponse:
    network = NetworksService(session).update(network_id, request.name, request.topology)
    if network is None:
        raise HTTPException(status_code=404, detail="Network not found")
    return network


@router.delete("/{network_id}", status_code=204)
def delete_network(network_id: int, session: Annotated[Session, Depends(get_session)]) -> Response:
    if not NetworksService(session).delete(network_id):
        raise HTTPException(status_code=404, detail="Network not found")
    return Response(status_code=204)


@router.get("/{network_id}/topology", response_model=TopologyResponse)
def get_topology(network_id: int, session: Annotated[Session, Depends(get_session)]) -> TopologyResponse:
    result = NetworksService(session).topology(network_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Network not found")
    topology, last_updated = result
    return TopologyResponse(topology=topology, source="SIMULATED", last_updated=last_updated)
