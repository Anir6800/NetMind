# Agents

Agent behavior and decision-making components.

`AgentWorkflow` is a bounded, read-only dry-run flow: collect, diagnose, propose, validate, then await approval. It persists per-incident state when `state_dir` is writable and never executes recovery actions.
