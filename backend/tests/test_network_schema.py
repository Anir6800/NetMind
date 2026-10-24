import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.network import Topology
from app.services.networks import generated_topology


def demo() -> dict:
    return json.loads((Path(__file__).parents[2] / "data/topologies/demo_six_nodes.json").read_text())


def test_demo_topology_is_valid() -> None:
    assert Topology.model_validate(demo()).version == "v1"


def test_rejects_link_to_missing_interface() -> None:
    topology = demo()
    topology["links"][0]["a"]["interface_id"] = "missing"
    with pytest.raises(ValidationError, match="existing interface"):
        Topology.model_validate(topology)


def test_rejects_baseline_path_with_missing_link() -> None:
    topology = demo()
    topology["expected_baseline_paths"][0]["link_ids"] = ["missing-link"]
    with pytest.raises(ValidationError, match="existing links"):
        Topology.model_validate(topology)


def test_supports_student_network_devices_and_timing() -> None:
    topology = demo()
    topology["nodes"][1].update({"type": "firewall", "processing_delay_ms": 0.8, "routing_protocol": "ospf"})
    topology["links"][0].update({"loss_pct": 1.5, "jitter_ms": 0.4})
    parsed = Topology.model_validate(topology)
    assert parsed.nodes[1].type.value == "firewall"
    assert parsed.links[0].loss_pct == 1.5


def test_generated_lab_has_fifty_devices_and_a_backup_path() -> None:
    topology = generated_topology(50, "campus", "ospf")

    assert len(topology.nodes) == 50
    assert topology.links[-1].id == "link-backup"
    assert topology.links[-1].delay_ms == 50
    assert "link-backup" not in topology.expected_baseline_paths[0].link_ids
