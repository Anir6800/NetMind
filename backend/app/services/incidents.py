from sqlalchemy.orm import Session

from app.repositories.incidents import IncidentsRepository


class IncidentsService:
    def __init__(self, session: Session) -> None:
        self.repository = IncidentsRepository(session)

    def list(self, network_id: int | None, state: str | None, limit: int, offset: int):
        return self.repository.list(network_id, state, limit, offset)

    def get(self, incident_id: int):
        return self.repository.get(incident_id)
