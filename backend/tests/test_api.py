from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.models import Base
from app.db.session import get_session
from app.main import app
from app.repositories.incidents import IncidentsRepository
from app.repositories.networks import NetworksRepository


def client() -> TestClient:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = Session(engine)
    network = NetworksRepository(session).create("demo", "v1")
    IncidentsRepository(session).create(network.id, "Demo incident", "warning")
    session.commit()

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    return TestClient(app)


def test_network_and_incident_endpoints_return_typed_data() -> None:
    with client() as api:
        assert api.get("/networks").json() == [{"id": 1, "name": "demo", "topology_version": "v1"}]
        assert api.get("/networks/1/topology").json()["version"] == "v1"
        assert api.get("/incidents?limit=1").json()[0]["title"] == "Demo incident"


def test_endpoints_return_404_and_422() -> None:
    with client() as api:
        assert api.get("/networks/99/topology").status_code == 404
        assert api.get("/incidents/99").status_code == 404
        assert api.get("/incidents?limit=0").status_code == 422


def test_openapi_contract_declares_typed_paginated_routes() -> None:
    paths = app.openapi()["paths"]
    assert paths["/networks"]["get"]["responses"]["200"]["content"]
    assert {item["name"] for item in paths["/incidents"]["get"]["parameters"]} >= {"limit", "offset"}
