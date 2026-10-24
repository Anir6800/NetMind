from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Device, Network


class NetworksRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create(self, name: str, topology_version: str) -> Network:
        network = Network(name=name, topology_version=topology_version)
        self.session.add(network)
        self.session.flush()
        return network

    def add_device(self, network_id: int, name: str, device_type: str) -> Device:
        device = Device(network_id=network_id, name=name, device_type=device_type)
        self.session.add(device)
        self.session.flush()
        return device

    def list(self) -> list[Network]:
        return list(self.session.scalars(select(Network).order_by(Network.id)))

    def get(self, network_id: int) -> Network | None:
        return self.session.get(Network, network_id)

    def delete(self, network: Network) -> None:
        self.session.delete(network)
