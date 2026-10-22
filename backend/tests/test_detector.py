from pathlib import Path

import pytest

from app.services.incidents.detector import IncidentDetector, IncidentState, transition

TOPOLOGY = Path(__file__).parents[2] / "data/topologies/demo_six_nodes.json"


def sample(time: float, **values) -> dict:
    return {"source": "SIMULATED", "monotonic_time": time, **values}


def test_loss_uses_debounce_hysteresis_and_metric_evidence() -> None:
    detector = IncidentDetector(TOPOLOGY)
    for now in range(2):
        assert detector.evaluate(sample(now, link_id="router-a-router-b", loss_pct=10)) == []
    incident = detector.evaluate(sample(2, link_id="router-a-router-b", loss_pct=25))[0]
    assert incident.kind == "loss"
    assert incident.severity_score == 100
    assert incident.evidence == {"source": "SIMULATED", "monotonic_time": 2, "metric_value": 25.0}
    for now in range(3, 6):
        detector.evaluate(sample(now, link_id="router-a-router-b", loss_pct=5))
    assert detector.active == {}


def test_link_down_correlates_downstream_unreachable_hosts_and_damps_flaps() -> None:
    detector = IncidentDetector(TOPOLOGY, flap_damping_s=30)
    outage = sample(1, link_states={"router-a-router-b": "down"}, unreachable_nodes=["host-b"])
    for _ in range(2):
        assert detector.evaluate(outage) == []
    incidents = detector.evaluate(outage)
    assert [(incident.kind, incident.location) for incident in incidents] == [("link_down", "router-a-router-b")]
    for now in range(2, 5):
        detector.evaluate(sample(now, link_states={"router-a-router-b": "up"}))
    for now in range(5, 8):
        assert detector.evaluate(sample(now, link_states={"router-a-router-b": "down"})) == []


def test_unreachable_host_and_latency_spike_are_detected() -> None:
    detector = IncidentDetector(TOPOLOGY)
    for now in range(3):
        detector.evaluate(sample(now, unreachable_nodes=["host-b"], link_id="router-a-router-b", rtt_ms=120))
    assert {(incident.kind, incident.location) for incident in detector.active.values()} == {("host_unreachable", "host-b"), ("latency", "router-a-router-b")}


@pytest.mark.parametrize(
    ("state", "target"),
    [
        (IncidentState.OPEN, IncidentState.OPEN),
        (IncidentState.ACKNOWLEDGED, IncidentState.OPEN),
        (IncidentState.ACKNOWLEDGED, IncidentState.ACKNOWLEDGED),
        (IncidentState.RESOLVED, IncidentState.OPEN),
        (IncidentState.RESOLVED, IncidentState.ACKNOWLEDGED),
        (IncidentState.RESOLVED, IncidentState.RESOLVED),
    ],
)
def test_incident_state_machine_rejects_illegal_transitions(state: IncidentState, target: IncidentState) -> None:
    with pytest.raises(ValueError, match="illegal incident transition"):
        transition(state, target)


def test_incident_state_machine_allows_legal_transitions() -> None:
    assert transition(IncidentState.OPEN, IncidentState.ACKNOWLEDGED) is IncidentState.ACKNOWLEDGED
    assert transition(IncidentState.OPEN, IncidentState.RESOLVED) is IncidentState.RESOLVED
    assert transition(IncidentState.ACKNOWLEDGED, IncidentState.RESOLVED) is IncidentState.RESOLVED
