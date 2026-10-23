from pathlib import Path
from tempfile import TemporaryDirectory

from app.agents.workflow import AgentWorkflow, WorkflowConfig, dry_run


def test_dry_run_produces_typed_proposal_without_execution() -> None:
    evidence = {"probe-1": {"loss_pct": 20}}
    with TemporaryDirectory(dir=Path.cwd()) as state_dir:
        proposal = dry_run(7, evidence, Path(state_dir))
        assert proposal.incident_id == 7
        assert proposal.evidence_ids == ["probe-1"]
        assert proposal.status == "awaiting_approval"
        assert proposal.recommended_action_ref == "review_evidence"
        assert not (Path(state_dir) / "executed").exists()


def test_workflow_state_replays_deterministically() -> None:
    with TemporaryDirectory(dir=Path.cwd()) as state_dir:
        workflow = AgentWorkflow(WorkflowConfig(state_dir=Path(state_dir)))
        evidence = {"b": {"value": 2}, "a": {"value": 1}}
        first = workflow.run(3, evidence)
        replayed = workflow.replay(3)
        assert replayed == first
        assert first.step_count == 5
