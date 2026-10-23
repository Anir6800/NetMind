"""Read-only incident Q&A grounded exclusively in immutable audit evidence."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.integrations.nvidia_client import NvidiaClient
from app.repositories.audit import AuditRepository
from app.services.ai.fallback import summarize

EXECUTION_PATTERN = re.compile(r"\b(run|execute|launch|shell|ssh|curl|wget|docker|ip|tc|ovs-vsctl)\b", re.IGNORECASE)


@dataclass(frozen=True)
class CopilotAnswer:
    answer: str
    citation_ids: list[str]
    source: str
    cloud_api_called: bool
    offline: bool = False


class CopilotService:
    def __init__(self, session: Session, client: NvidiaClient | object) -> None:
        self.audit = AuditRepository(session)
        self.client = client

    def ask(self, incident_id: int, question: str) -> CopilotAnswer:
        evidence = self._evidence(incident_id)
        citations = list(evidence)
        if EXECUTION_PATTERN.search(question):
            return CopilotAnswer("I can explain stored evidence, but I cannot run commands or change the network.", citations, "LOCAL_REFUSAL", False)
        if not evidence:
            return CopilotAnswer("No stored evidence is available for this incident.", [], "LOCAL_EVIDENCE", False)
        diagnosis = self.client.diagnose({"question": question, "incident_evidence": evidence})
        if diagnosis.offline:
            fallback = summarize(evidence)
            return CopilotAnswer(f"{fallback.summary} Manual runbook: {' '.join(fallback.runbook)}", citations, "OFFLINE_READ_ONLY", False, True)
        return CopilotAnswer(diagnosis.summary, citations, diagnosis.source, True)

    def _evidence(self, incident_id: int) -> dict[str, dict]:
        evidence: dict[str, dict] = {}
        for event in self.audit.timeline()[-20:]:
            payload = json.loads(event.payload)
            if payload.get("incident_id") == incident_id:
                evidence[f"audit:{event.id}"] = {"event_type": event.event_type, "payload": payload}
        return evidence
