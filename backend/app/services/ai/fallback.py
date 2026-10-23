"""Deterministic, read-only diagnosis used when the cloud provider is unavailable."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class OfflineDiagnosis:
    summary: str
    runbook: tuple[str, ...]
    recommended_action: None = None


def summarize(evidence: dict[str, dict]) -> OfflineDiagnosis:
    event_types = sorted({str(item.get("event_type", "evidence")) for item in evidence.values()})
    labels = ", ".join(event_types) or "stored evidence"
    return OfflineDiagnosis(
        summary=f"Cloud diagnosis is unavailable. Read-only summary from {len(evidence)} immutable evidence item(s): {labels}.",
        runbook=("Confirm the affected path with fresh telemetry.", "Review the linked audit evidence and topology state.", "No automatic action is proposed; request human review for any recovery plan."),
    )
