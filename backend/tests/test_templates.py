import json
from pathlib import Path

import pytest

from app.services.templates import TEMPLATE_BY_ID, TEMPLATES, build_template
from app.services.topology_builder import validate_lab
from tests.test_api import client

EXPORTED = Path(__file__).parents[2] / "data/templates"


def test_at_least_twenty_unique_templates() -> None:
    ids = [template["id"] for template in TEMPLATES]
    assert len(ids) >= 20
    assert len(set(ids)) == len(ids)
    assert all(template_id.replace("-", "").isalnum() and template_id == template_id.lower() for template_id in ids)


def test_size_coverage() -> None:
    sizes = [len(build_template(template).nodes) for template in TEMPLATES]
    assert sum(size >= 40 for size in sizes) >= 4
    assert sum(size <= 10 for size in sizes) >= 2


@pytest.mark.parametrize("template", TEMPLATES, ids=lambda template: template["id"])
def test_template_builds_valid_lab_matching_export(template) -> None:
    topology = build_template(template)
    assert validate_lab(topology) == []
    assert len(topology.nodes) == template["spec"].total <= 50
    exported = json.loads((EXPORTED / f"{template['id']}.json").read_text(encoding="utf-8"))
    assert exported == topology.model_dump(mode="json"), "stale fixture: run python scripts/export_templates.py"


def test_templates_endpoint_lists_all() -> None:
    with client() as api:
        listed = api.get("/networks/templates").json()
    assert [item["id"] for item in listed] == [template["id"] for template in TEMPLATES]
    assert set(listed[0]) == {"id", "label", "category", "description", "device_count", "protocol", "style"}
    assert listed[0]["device_count"] == len(build_template(TEMPLATES[0]).nodes)


def test_generate_from_template_skips_ai(monkeypatch) -> None:
    monkeypatch.setattr("app.services.networks.plan_network", lambda *args: pytest.fail("planner called"))
    with client() as api:
        response = api.post("/networks/generate", json={"name": "RIP lab", "category": "rip-lab", "prompt": ""})
    assert response.status_code == 201
    generated = response.json()
    assert generated["source"] == "TEMPLATE"
    assert generated["answered_by"] == "Prepared template (no AI)"
    assert generated["topology"] == build_template(TEMPLATE_BY_ID["rip-lab"]).model_dump(mode="json")
