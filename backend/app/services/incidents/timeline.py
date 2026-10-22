from datetime import datetime

from app.repositories.audit import AuditRepository


class IncidentTimeline:
    def __init__(self, repository: AuditRepository) -> None:
        self.repository = repository

    def detection(self, incident_id: int, evidence: dict, created_at: datetime | None = None):
        return self.repository.append("detection", {"incident_id": incident_id, "evidence": evidence}, created_at)

    def diagnosis_request(self, incident_id: int, request: dict, created_at: datetime | None = None):
        return self.repository.append("diagnosis_request", {"incident_id": incident_id, "request": request}, created_at)

    def approval(self, incident_id: int, approval: dict, created_at: datetime | None = None):
        return self.repository.append("approval", {"incident_id": incident_id, "approval": approval}, created_at)

    def action_transition(self, incident_id: int, action: dict, created_at: datetime | None = None):
        return self.repository.append("action_transition", {"incident_id": incident_id, "action": action}, created_at)
