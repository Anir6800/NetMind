import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.network import Topology
from app.services.topology_builder import NetworkSpec, build_topology, validate_lab


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


def test_builder_makes_valid_labs_for_every_style_and_size() -> None:
    for style in ("hierarchical", "ring", "mesh", "star", "leaf-spine", "bus"):
        for spec in (
            NetworkSpec(style=style),
            NetworkSpec(style=style, routers=4, firewalls=1, switches=5, access_points=2, hubs=1, repeaters=1, servers=4, hosts=32, redundancy=True),
            NetworkSpec(style=style, routers=0, switches=2, servers=0, hosts=6),
            NetworkSpec(style=style, routers=2, switches=0, servers=1, hosts=4),
        ):
            topology = build_topology(spec)
            assert len(topology.nodes) == spec.total
            assert validate_lab(topology) == [], (style, spec)


def test_validator_reports_disconnected_and_duplicate_ip() -> None:
    topology = build_topology(NetworkSpec(routers=1, switches=1, servers=1, hosts=2))
    topology.links.pop()
    topology.nodes[-1].interfaces[0].address = topology.nodes[-2].interfaces[0].address
    problems = validate_lab(topology)
    assert any("not connected" in problem for problem in problems)
    assert any("is used by both" in problem for problem in problems)
