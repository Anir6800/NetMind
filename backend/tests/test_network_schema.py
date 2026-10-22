import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.network import Topology


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
