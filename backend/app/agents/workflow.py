"""Bounded, read-only incident workflow; approval is the terminal state."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from time import monotonic
from typing import Any, ClassVar

from pydantic import BaseModel, Field

from app.services.ai.diagnosis import ALLOWLIST_ACTION_IDS


class WorkflowProposal(BaseModel):
    incident_id: int = Field(gt=0)
    probable_cause: str = Field(min_length=1)
    evidence_ids: list[str] = Field(min_length=1)
    recommended_action_ref: str | None = None
    status: str = "awaiting_approval"


class WorkflowState(BaseModel):
    incident_id: int = Field(gt=0)
    step: str
    step_count: int = Field(ge=0)
    evidence: dict[str, dict[str, Any]] = Field(default_factory=dict)
    proposal: WorkflowProposal | None = None


@dataclass(frozen=True)
class WorkflowConfig:
    max_steps: int = 5
    node_timeout_seconds: float = 1.0
    state_dir: Path | None = None


class AgentWorkflow:
    _memory_states: ClassVar[dict[int, WorkflowState]] = {}

    def __init__(self, config: WorkflowConfig | None = None) -> None:
        self.config = config or WorkflowConfig()
        if self.config.max_steps < 5 or self.config.node_timeout_seconds <= 0:
            raise ValueError("workflow bounds are too small")

    def run(self, incident_id: int, evidence: dict[str, dict[str, Any]]) -> WorkflowState:
        state = WorkflowState(incident_id=incident_id, step="collect", step_count=0)
        for name, node in (("collect", self._collect), ("diagnose", self._diagnose), ("propose", self._propose), ("validate", self._validate), ("await_approval", self._await_approval)):
            if state.step_count >= self.config.max_steps:
                raise RuntimeError("workflow exceeded maximum steps")
            started = monotonic()
            state = node(state, evidence)
            state.step = name
            state.step_count += 1
            if monotonic() - started > self.config.node_timeout_seconds:
                raise TimeoutError(f"workflow node timed out: {name}")
        self._persist(state)
        return state

    def replay(self, incident_id: int) -> WorkflowState:
        path = self._path(incident_id)
        if path and path.exists():
            try:
                return WorkflowState.model_validate_json(path.read_text())
            except PermissionError:
                pass
        if incident_id in self._memory_states:
            return self._memory_states[incident_id]
        raise FileNotFoundError(f"no saved workflow for incident {incident_id}")

    @staticmethod
    def _collect(state: WorkflowState, evidence: dict[str, dict[str, Any]]) -> WorkflowState:
        return state.model_copy(update={"evidence": json.loads(json.dumps(evidence, sort_keys=True))})

    @staticmethod
    def _diagnose(state: WorkflowState, _: dict[str, dict[str, Any]]) -> WorkflowState:
        return state.model_copy(update={"proposal": WorkflowProposal(incident_id=state.incident_id, probable_cause="Review collected network evidence.", evidence_ids=sorted(state.evidence))})

    @staticmethod
    def _propose(state: WorkflowState, _: dict[str, dict[str, Any]]) -> WorkflowState:
        assert state.proposal is not None
        return state.model_copy(update={"proposal": state.proposal.model_copy(update={"recommended_action_ref": "review_evidence"})})

    @staticmethod
    def _validate(state: WorkflowState, _: dict[str, dict[str, Any]]) -> WorkflowState:
        assert state.proposal is not None
        action = state.proposal.recommended_action_ref
        if action not in ALLOWLIST_ACTION_IDS and action != "review_evidence":
            raise ValueError("proposal action is not allowlisted")
        return state

    @staticmethod
    def _await_approval(state: WorkflowState, _: dict[str, dict[str, Any]]) -> WorkflowState:
        return state.model_copy(update={"proposal": state.proposal.model_copy(update={"status": "awaiting_approval"})})

    def _path(self, incident_id: int) -> Path | None:
        return self.config.state_dir / "workflow" / f"incident-{incident_id}.json" if self.config.state_dir else None

    def _persist(self, state: WorkflowState) -> None:
        path = self._path(state.incident_id)
        if path:
            try:
                path.mkdir(parents=True, exist_ok=True)
                path.write_text(state.model_dump_json(indent=2))
            except PermissionError:
                pass
        self._memory_states[state.incident_id] = state


def dry_run(incident_id: int, evidence: dict[str, dict[str, Any]], state_dir: Path | None = None) -> WorkflowProposal:
    return AgentWorkflow(WorkflowConfig(state_dir=state_dir)).run(incident_id, evidence).proposal  # type: ignore[return-value]
