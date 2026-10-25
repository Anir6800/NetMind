from app.services.templates import TEMPLATE_BY_ID, build_template
from tests.test_api import client


def _node(i: int, ip: str) -> dict:
    return {"id": f"host-{i}", "type": "host", "interfaces": [{"id": "eth0", "address": ip}]}


def _topology(nodes: list[dict]) -> dict:
    return {"version": "v1", "addressing_plan": "test", "nodes": nodes, "links": [], "expected_baseline_paths": []}


def test_export_import_round_trip_is_exact() -> None:
    topology = build_template(TEMPLATE_BY_ID["ladder-small"]).model_dump(mode="json")
    with client() as api:
        created = api.post("/networks", json={"name": "Lab", "topology": topology}).json()
        exported = api.get(f"/networks/{created['id']}/topology").json()["topology"]
        imported = api.post("/networks/import", json={"name": "Imported", "topology": exported})
        assert imported.status_code == 201
        assert api.get(f"/networks/{imported.json()['id']}/topology").json()["topology"] == exported


def test_duplicate_names_copy_then_copy_2() -> None:
    with client() as api:
        original = api.get("/networks/1/topology").json()["topology"]
        first = api.post("/networks/1/duplicate")
        second = api.post("/networks/1/duplicate")
        assert first.status_code == second.status_code == 201
        assert first.json()["name"] == "demo (copy)"
        assert second.json()["name"] == "demo (copy 2)"
        assert api.get(f"/networks/{first.json()['id']}/topology").json()["topology"] == original
        assert api.post("/networks/99/duplicate").status_code == 404


def test_import_rejects_duplicate_ip_and_oversize() -> None:
    with client() as api:
        response = api.post("/networks/import", json={"name": "Bad", "topology": _topology([_node(1, "10.0.0.1/24"), _node(2, "10.0.0.1/24")])})
        assert response.status_code == 422
        assert response.json()["detail"].startswith("Import rejected: IP 10.0.0.1 is used by both host-1 and host-2")
        big = _topology([_node(i, f"10.0.{i}.1/24") for i in range(51)])
        assert api.post("/networks/import", json={"name": "Big", "topology": big}).status_code == 422


def test_import_accepts_disconnected_and_dedupes_name() -> None:
    with client() as api:
        response = api.post("/networks/import", json={"name": "demo", "topology": _topology([_node(1, "10.0.0.1/24"), _node(2, "10.0.1.1/24")])})
        assert response.status_code == 201
        assert response.json()["name"] == "demo (2)"
