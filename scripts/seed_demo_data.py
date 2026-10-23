"""Create the idempotent local network record required by the demo UI."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Device, Network
from app.db.session import get_engine


def main() -> None:
    fixture = json.loads((Path(__file__).parents[1] / "data/topologies/demo_six_nodes.json").read_text())
    with Session(get_engine()) as session:
        network = session.get(Network, 1)
        if network is None:
            network = Network(id=1, name="demo", topology_version=fixture["version"])
            session.add(network)
            session.flush()
        existing = set(session.scalars(select(Device.name).where(Device.network_id == network.id)))
        for node in fixture["nodes"]:
            if node["id"] not in existing:
                session.add(Device(network_id=network.id, name=node["id"], device_type=node["type"]))
        session.commit()
    print("Demo network seeded: id=1, topology=demo_six_nodes")


if __name__ == "__main__":
    main()
