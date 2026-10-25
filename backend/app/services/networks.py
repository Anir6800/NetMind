import json
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.integrations.nvidia_client import get_ai_client
from app.repositories.networks import NetworksRepository
from app.schemas.network import Topology
from app.services.assistant import plan_network
from app.services.topology_builder import build_topology, validate_lab


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

    def generate(self, name: str, device_count: int, category: str, protocol: str, prompt: str = "", form: dict | None = None):
        defaults = {"device_count": device_count, "protocol": protocol, "category": category}
        spec, answer = plan_network(get_ai_client(), prompt, form, defaults)
        topology = build_topology(spec, f"{category} · {spec.style} · {spec.protocol.upper()}")
        problems = validate_lab(topology)
        if problems:
            raise ValueError("Generated network rejected: " + "; ".join(problems))
        return self.create(name, topology), topology, spec, answer
