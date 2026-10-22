"""Deterministic localization and strict validation before any AI explanation is accepted."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

from pydantic import ValidationError

from app.schemas.ai import AiDiagnosis

ALLOWLIST_ACTION_IDS = {"clear_netem", "replace_route", "set_link_state", "set_netem"}


@dataclass(frozen=True)
class ProbeResult:
    evidence_id: str
    link_ids: list[str]
    passed: bool


@dataclass(frozen=True)
class LocalizerOutput:
    candidate_link_ids: list[str]
    cleared_link_ids: list[str]
    failed_evidence_ids: list[str]


class FaultLocalizer:
    def __init__(self, topology_path: Path) -> None:
        topology = json.loads(topology_path.read_text())
        self.link_ids = {link["id"] for link in topology["links"]}

    def localize(self, probes: list[ProbeResult]) -> LocalizerOutput:
        unknown = {link_id for probe in probes for link_id in probe.link_ids} - self.link_ids
        if unknown:
            raise ValueError("probe references unknown topology link")
        cleared = {link_id for probe in probes if probe.passed for link_id in probe.link_ids}
        failed = [probe for probe in probes if not probe.passed]
        paths = {probe.evidence_id: set(probe.link_ids) - cleared for probe in failed}
        if any(not path for path in paths.values()):
            raise ValueError("failed probe has no candidate link after passed probes clear paths")
        selected: list[str] = []
        uncovered = set(paths)
        while uncovered:
            candidates = sorted({link_id for evidence_id in uncovered for link_id in paths[evidence_id]})
            best = max(candidates, key=lambda link_id: sum(link_id in paths[evidence_id] for evidence_id in uncovered))
            selected.append(best)
            uncovered = {evidence_id for evidence_id in uncovered if best not in paths[evidence_id]}
        return LocalizerOutput(sorted(selected), sorted(cleared), [probe.evidence_id for probe in failed])


@dataclass(frozen=True)
class GroundedDiagnosis:
    diagnosis: AiDiagnosis
    localizer: LocalizerOutput
    localizer_agreement: bool


class DiagnosisService:
    @staticmethod
    def provider_context(localizer: LocalizerOutput, evidence: dict[str, dict]) -> dict:
        return {"localizer": asdict(localizer), "evidence": evidence}

    @staticmethod
    def validate(raw: dict, localizer: LocalizerOutput, evidence: dict[str, dict]) -> GroundedDiagnosis:
        diagnosis = AiDiagnosis.model_validate(raw)
        unknown_evidence = set(diagnosis.evidence_ids) - set(evidence)
        if unknown_evidence:
            raise ValueError("diagnosis references unknown evidence IDs")
        if set(diagnosis.candidate_link_ids) - set(localizer.candidate_link_ids):
            raise ValueError("diagnosis references links outside deterministic localizer output")
        if diagnosis.recommended_action_ref and diagnosis.recommended_action_ref not in ALLOWLIST_ACTION_IDS:
            raise ValueError("diagnosis references an action outside the allowlist")
        return GroundedDiagnosis(diagnosis, localizer, set(diagnosis.candidate_link_ids) == set(localizer.candidate_link_ids))


def validate_provider_output(raw: str | dict, localizer: LocalizerOutput, evidence: dict[str, dict]) -> GroundedDiagnosis:
    try:
        parsed = json.loads(raw) if isinstance(raw, str) else raw
    except json.JSONDecodeError as error:
        raise ValueError("provider output is not valid JSON") from error
    try:
        return DiagnosisService.validate(parsed, localizer, evidence)
    except ValidationError as error:
        raise ValueError("provider output does not match the diagnosis schema") from error
