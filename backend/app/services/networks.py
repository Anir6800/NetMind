import json
import re
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.repositories.networks import NetworksRepository
from app.schemas.network import Topology


class NetworksService:
    def __init__(self, session: Session) -> None:
        self.repository = NetworksRepository(session)

    def list(self):
        return self.repository.list()

    def topology(self, network_id: int) -> tuple[Topology, datetime] | None:
        network = self.repository.get(network_id)
        if not network:
            return None
        if network.topology_data:
            return Topology.model_validate_json(network.topology_data), datetime.now(UTC)
        path = Path(__file__).parents[3] / "data/topologies/demo_six_nodes.json"
        return Topology.model_validate(json.loads(path.read_text())), datetime.fromtimestamp(path.stat().st_mtime, UTC)

    def create(self, name: str, topology: Topology):
        network = self.repository.create(name, topology.version)
        network.topology_data = topology.model_dump_json()
        self.repository.session.commit()
        return network

    def update(self, network_id: int, name: str, topology: Topology):
        network = self.repository.get(network_id)
        if not network:
            return None
        network.name = name
        network.topology_version = topology.version
        network.topology_data = topology.model_dump_json()
        self.repository.session.commit()
        return network

    def delete(self, network_id: int) -> bool:
        network = self.repository.get(network_id)
        if not network:
            return False
        self.repository.delete(network)
        self.repository.session.commit()
        return True

    def generate(self, name: str, device_count: int, category: str, protocol: str, prompt: str = ""):
        requested = re.search(r"\b(\d{1,2})\s*(?:devices?|nodes?)\b", prompt.lower())
        count = min(50, max(6, int(requested.group(1)) if requested else device_count))
        topology = generated_topology(count, category, protocol)
        return self.create(name, topology), topology


def generated_topology(device_count: int, category: str, protocol: str) -> Topology:
    types = ["router", "firewall", "switch", "switch"]
    pool = ["host", "server", "access-point", "hub", "repeater"] if category in {"campus", "office", "home", "wireless-mesh"} else ["server", "host", "switch", "router", "firewall"]
    types.extend(pool[index % len(pool)] for index in range(device_count - len(types)))
    nodes = []
    for index, kind in enumerate(types[:device_count]):
        node_id = f"{kind}-{index + 1}"
        nodes.append({"id": node_id, "type": kind, "interfaces": [{"id": f"port-{port + 1}", "address": f"10.{index // 250}.{index % 250}.{port + 1}/24"} for port in range(4)], "x": (index % 10) * 180, "y": (index // 10) * 130, "processing_delay_ms": round(0.1 + (index % 5) * 0.15, 2), "routing_protocol": protocol})
    links = []
    for index in range(1, device_count):
        parent = (index - 1) // 3
        child_port = 1
        parent_port = ((index - 1) % 3) + 2
        links.append({"id": f"link-{parent + 1}-{index + 1}", "a": {"node_id": nodes[parent]["id"], "interface_id": f"port-{parent_port}"}, "b": {"node_id": nodes[index]["id"], "interface_id": f"port-{child_port}"}, "capacity_mbps": 1000 if category in {"data-center", "isp-backbone"} else 100, "delay_ms": 1 + (index % 7), "loss_pct": 0, "jitter_ms": round((index % 4) * 0.2, 1), "state": "up"})
    hosts = [node["id"] for node in nodes if node["type"] in {"host", "server"}]
    source, destination = hosts[0], hosts[-1]
    parent_by_node = {nodes[index]["id"]: nodes[(index - 1) // 3]["id"] for index in range(1, device_count)}
    link_by_pair = {frozenset((link["a"]["node_id"], link["b"]["node_id"])): link["id"] for link in links}
    def ancestors(node_id: str) -> list[str]:
        result = [node_id]
        while node_id in parent_by_node:
            node_id = parent_by_node[node_id]
            result.append(node_id)
        return result
    left, right = ancestors(source), ancestors(destination)
    common = next(node_id for node_id in left if node_id in right)
    path_nodes = left[:left.index(common) + 1] + list(reversed(right[:right.index(common)]))
    path_links = [link_by_pair[frozenset((path_nodes[index], path_nodes[index + 1]))] for index in range(len(path_nodes) - 1)]
    links.append({"id": "link-backup", "a": {"node_id": source, "interface_id": "port-4"}, "b": {"node_id": destination, "interface_id": "port-4"}, "capacity_mbps": 10, "delay_ms": 50, "loss_pct": 0.5, "jitter_ms": 2, "state": "up"})
    return Topology.model_validate({"version": "v1", "addressing_plan": f"10.0.0.0/8 · {category}", "nodes": nodes, "links": links, "expected_baseline_paths": [{"source_host_id": source, "destination_host_id": destination, "link_ids": path_links}]})
