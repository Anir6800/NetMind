from app.services.ai.fallback import summarize


def test_offline_summary_is_deterministic_and_read_only() -> None:
    evidence = {"audit:2": {"event_type": "detection"}, "audit:1": {"event_type": "detection"}}
    assert summarize(evidence) == summarize(dict(reversed(list(evidence.items()))))
    assert summarize(evidence).recommended_action is None
