import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Base
from app.repositories.incidents import IncidentsRepository
from app.repositories.networks import NetworksRepository


def test_network_and_incident_crud_roundtrip() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        networks = NetworksRepository(session)
        network = networks.create("demo", "v1")
        device = networks.add_device(network.id, "router-a", "router")
        IncidentsRepository(session).create(network.id, "Link degraded", "warning")
        session.commit()
        assert device.network_id == network.id
        assert [item.title for item in IncidentsRepository(session).list_open(network.id)] == ["Link degraded"]


def test_constraints_reject_invalid_incident_state() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        network = NetworksRepository(session).create("demo", "v1")
        session.flush()
        with pytest.raises(IntegrityError):
            session.connection().exec_driver_sql("INSERT INTO incidents (network_id, title, severity, state) VALUES (?, ?, ?, ?)", (network.id, "bad", "warning", "invalid"))
