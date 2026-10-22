from pathlib import Path

import pytest

from app.services.ai.diagnosis import (
    DiagnosisService,
    FaultLocalizer,
    ProbeResult,
    validate_provider_output,
)

TOPOLOGY = Path(__file__).parents[2] / "data/topologies/demo_six_nodes.json"


@pytest.fixture
def localizer() -> FaultLocalizer:
    return FaultLocalizer(TOPOLOGY)


def localized(localizer: FaultLocalizer):
    return localizer.localize(
        [
            ProbeResult("failed-a", ["host-a-switch-a", "switch-a-router-a"], False),
            ProbeResult("failed-b", ["switch-a-router-a", "router-a-router-b"], False),
            ProbeResult("failed-c", ["router-a-router-b", "router-b-switch-b"], False),
            ProbeResult("passed", ["host-a-switch-a"], True),
        ]
    )


def payload() -> dict:
    return {
        "probable_cause": "Two candidate links require investigation.",
        "confidence": 0.8,
        "evidence_ids": ["failed-a", "failed-b", "failed-c"],
        "candidate_link_ids": ["switch-a-router-a", "router-a-router-b"],
        "alternative_hypotheses": [{"probable_cause": "Transient loss", "confidence": 0.2}],
        "uncertainty_notes": "Only path probes are available.",
        "recommended_action_ref": "clear_netem",
    }


def test_probe_path_set_cover_localizes_and_passed_probe_clears_links(localizer: FaultLocalizer) -> None:
    result = localized(localizer)

    assert result.candidate_link_ids == ["router-a-router-b", "switch-a-router-a"]
    assert result.cleared_link_ids == ["host-a-switch-a"]
    assert result.failed_evidence_ids == ["failed-a", "failed-b", "failed-c"]


def test_grounded_diagnosis_accepts_known_evidence_and_reports_agreement(localizer: FaultLocalizer) -> None:
    result = DiagnosisService.validate(payload(), localized(localizer), {"failed-a": {}, "failed-b": {}, "failed-c": {}})

    assert result.localizer_agreement is True
    assert result.diagnosis.recommended_action_ref == "clear_netem"


@pytest.mark.parametrize(
    "invalid",
    [
        {**payload(), "evidence_ids": ["invented"]},
        {**payload(), "recommended_action_ref": "rm -rf /"},
        {**payload(), "command": "ip link set down"},
        {**payload(), "confidence": 2},
    ],
)
def test_rejects_ungrounded_or_malformed_provider_output(localizer: FaultLocalizer, invalid: dict) -> None:
    with pytest.raises(ValueError):
        validate_provider_output(invalid, localized(localizer), {"failed-a": {}, "failed-b": {}, "failed-c": {}})
