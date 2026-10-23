"""Create the idempotent local network record required by the demo UI."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Device, Incident, Network
from app.db.session import get_engine
from app.repositories.audit import AuditRepository
from app.repositories.incidents import IncidentsRepository

DEMO_INCIDENT_PREFIX = "Demo simulated"
DEMO_INCIDENT_COUNT = 100


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
        existing_incidents = list(
            session.scalars(select(Incident.id).where(Incident.network_id == network.id, Incident.title.startswith(DEMO_INCIDENT_PREFIX)))
        )
        incidents = IncidentsRepository(session)
        audit = AuditRepository(session)
        links = [link["id"] for link in fixture["links"]]
        severities = ("warning", "critical", "info")
        for number in range(len(existing_incidents) + 1, DEMO_INCIDENT_COUNT + 1):
            link_id = links[(number - 1) % len(links)]
            incident = incidents.create(network.id, f"{DEMO_INCIDENT_PREFIX} link event #{number:03}", severities[(number - 1) % len(severities)])
            incident.state = "resolved" if number % 5 == 0 else "open"
            audit.append("detection", {"incident_id": incident.id, "source": "SIMULATED", "evidence": {"link_id": link_id, "loss_pct": 100 if number % 3 == 0 else 12, "scenario": "demo_seed"}})
        session.commit()
    print(f"Demo data seeded: network id=1, topology=demo_six_nodes, incidents={DEMO_INCIDENT_COUNT}")


if __name__ == "__main__":
    main()
