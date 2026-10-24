from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.telemetry import store as telemetry_store
from app.db.models import Base
from app.db.session import get_session
from app.main import app
from app.repositories.audit import AuditRepository
from app.repositories.incidents import IncidentsRepository
from app.repositories.networks import NetworksRepository


def client(tamper_audit: bool = False) -> TestClient:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = Session(engine)
    network = NetworksRepository(session).create("demo", "v1")
    IncidentsRepository(session).create(network.id, "Demo incident", "warning")
    if tamper_audit:
        event = AuditRepository(session).append("detection", {"incident_id": 1})
        session.execute(text("UPDATE audit_events SET payload = :payload WHERE id = :id"), {"payload": '{"incident_id":999}', "id": event.id})
    session.commit()

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    return TestClient(app)


def test_network_and_incident_endpoints_return_typed_data() -> None:
    with client() as api:
        assert api.get("/networks").json() == [{"id": 1, "name": "demo", "topology_version": "v1"}]
        topology = api.get("/networks/1/topology").json()
        assert topology["topology"]["version"] == "v1"
        assert topology["source"] == "SIMULATED"
        assert api.get("/incidents?limit=1").json()[0]["title"] == "Demo incident"


def test_generates_and_persists_fifty_device_student_topology() -> None:
    with client() as api:
        response = api.post("/networks/generate", json={"name": "Campus lab", "category": "campus", "device_count": 50, "protocol": "ospf", "prompt": "Create 50 devices"})
        assert response.status_code == 201
        generated = response.json()
        assert generated["source"] == "SIMULATED_AI_PLANNER"
        assert len(generated["topology"]["nodes"]) == 50
        network_id = generated["network"]["id"]
        assert len(api.get(f"/networks/{network_id}/topology").json()["topology"]["nodes"]) == 50


def test_deletes_network_with_persisted_devices() -> None:
    with client() as api:
        session = next(iter(app.dependency_overrides[get_session]()))
        NetworksRepository(session).add_device(1, "host-a", "host")
        session.commit()

        assert api.delete("/networks/1").status_code == 204
        assert api.get("/networks/1/topology").status_code == 404


def test_incident_detail_includes_its_audit_evidence() -> None:
    with client() as api:
        session = next(iter(app.dependency_overrides[get_session]()))
        AuditRepository(session).append("detection", {"incident_id": 1, "evidence": {"link_id": "router-a-router-b", "scenario": "link_down"}})
        session.commit()
        detail = api.get("/incidents/1").json()
    assert detail["evidence"]["link_id"] == "router-a-router-b"
    assert detail["timeline"][0]["event_type"] == "detection"
    assert detail["diagnosis"]["confidence"] == 0.92


def test_endpoints_return_404_and_422() -> None:
    with client() as api:
        assert api.get("/networks/99/topology").status_code == 404
        assert api.get("/incidents/99").status_code == 404
        assert api.get("/incidents?limit=0").status_code == 422


def test_audit_verify_endpoint_returns_chain_status() -> None:
    with client() as api:
        assert api.get("/audit/verify").json() == {"valid": True, "invalid_event_id": None}


def test_audit_verify_endpoint_detects_tampering() -> None:
    with client(tamper_audit=True) as api:
        assert api.get("/audit/verify").json() == {"valid": False, "invalid_event_id": 1}


def test_event_poll_resumes_after_last_event_id() -> None:
    with client(tamper_audit=True) as api:
        assert api.get("/events/poll").json()[0]["id"] == 1
        assert api.get("/events/poll?last_event_id=1").json() == []


def test_openapi_contract_declares_typed_paginated_routes() -> None:
    paths = app.openapi()["paths"]
    assert paths["/networks"]["get"]["responses"]["200"]["content"]
    assert {item["name"] for item in paths["/incidents"]["get"]["parameters"]} >= {"limit", "offset"}


def test_telemetry_endpoint_labels_metric_source_and_age_fields() -> None:
    telemetry_store.samples.clear()
    telemetry_store.ingest({"source": "SIMULATED", "monotonic_time": 1, "wall_time": 1_700_000_000, "rtt_ms": 8, "loss_pct": None})
    with client() as api:
        metric = api.get("/telemetry/latest").json()["metrics"][0]
    assert metric == {"name": "Round-trip time", "value": 8.0, "unit": "ms", "source": "SIMULATED", "sampled_at": "2023-11-14T22:13:20Z", "ttl_seconds": 15.0, "state": "STALE"}
    telemetry_store.samples.clear()
