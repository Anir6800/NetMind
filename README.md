# NetMind AI

NetMind AI is a college networking project. The repository is currently at the local-environment and architecture baseline stage.

## Development

Run the local capability probe:

```text
python scripts/probe_capabilities.py
```

It selects `MININET` only when the required Linux networking capabilities are present; otherwise it selects `SIMULATED`.

## Branch conventions

- `main`: stable reviewed work.
- `dev`: integration branch for completed task work.
- `feature/<task-id>-<short-name>`: task implementation branches.
- `fix/<task-id>-<short-name>`: corrective work.

Keep secrets in local environment files or secret stores; never commit credentials.
