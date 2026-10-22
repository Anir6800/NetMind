from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Incident


class IncidentsRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create(self, network_id: int, title: str, severity: str) -> Incident:
        incident = Incident(network_id=network_id, title=title, severity=severity)
        self.session.add(incident)
        self.session.flush()
        return incident

    def list_open(self, network_id: int) -> list[Incident]:
        return list(self.session.scalars(select(Incident).where(Incident.network_id == network_id, Incident.state != "resolved").order_by(Incident.created_at.desc())))

    def list(self, network_id: int | None, state: str | None, limit: int, offset: int) -> list[Incident]:
        statement = select(Incident).order_by(Incident.created_at.desc()).offset(offset).limit(limit)
        if network_id is not None:
            statement = statement.where(Incident.network_id == network_id)
        if state is not None:
            statement = statement.where(Incident.state == state)
        return list(self.session.scalars(statement))

    def get(self, incident_id: int) -> Incident | None:
        return self.session.get(Incident, incident_id)
