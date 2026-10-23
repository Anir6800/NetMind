# NetMind

NetMind is a local-only college networking MVP for evidence-bound incident diagnosis and human-approved recovery. It provides a topology view, incident timeline, read-only diagnosis, approval gate, recovery verification/rollback labels, and a deterministic simulation fallback.

## Stable handoff: v0.1.0

This release is intended for local demonstration only. Start with the [operations handbook](docs/setup/operations.md), then follow the [demo script](docs/demo-script.md). The UI evidence pack is in [docs/evidence](docs/evidence/README.md).

The simulation controller is loopback-only and token-authenticated. The browser cannot execute a controller action. Optional cloud diagnosis keys remain local and unavailable diagnosis falls back to deterministic read-only behavior.

## Verification

The release handoff was verified with:

- frontend fixture E2E tests: 2 passed;
- frontend production build: passed;
- backend tests: 125 passed.

The live controller stack must be checked on the target machine with `bash scripts/check-netmind.sh` after Docker Desktop's Linux engine is running. Do not present fixture evidence as a live controller run.

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
