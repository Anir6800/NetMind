import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.repositories.networks import NetworksRepository
from app.schemas.network import Topology


class NetworksService:
    def __init__(self, session: Session) -> None:
        self.repository = NetworksRepository(session)

    def list(self):
        return self.repository.list()

    def topology(self, network_id: int) -> Topology | None:
        if not self.repository.get(network_id):
            return None
        path = Path(__file__).parents[3] / "data/topologies/demo_six_nodes.json"
        return Topology.model_validate(json.loads(path.read_text()))
