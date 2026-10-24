# Troubleshooting local services

Run the local audit from the repository root after starting the stack:

```bash
bash scripts/check-netmind.sh
```

It fails fast when PostgreSQL, FastAPI, Vite, the Firebase Auth emulator, or the loopback simulation controller is unreachable. It checks the optional NVIDIA diagnosis API only when `NVIDIA_API_KEY` is exported; the application remains read-only and deterministic when that check is skipped or the provider is unavailable.

## Before retrying

Use Git Bash or a Linux/WSL shell, keep Docker Desktop's Linux engine running, and ensure `docker`, `python`, `npm`, and `firebase` resolve in that same shell. See [operations.md](operations.md) for the expected loopback ports and start sequence. Do not expose a port or loosen a controller binding to resolve a local conflict.

| Symptom | Safe check and recovery |
| --- | --- |
| Docker engine is unavailable | Start Docker Desktop and wait until `docker compose ps` works, then rerun `bash scripts/dev-netmind.sh`. |
| A required port is already in use | Identify and stop the local conflicting process; preserve the documented `127.0.0.1` bindings. |
| Launcher rejects the controller token | Set a new non-empty `NETMIND_CONTROLLER_TOKEN` in the launcher shell. Do not supply it as a command-line argument or commit it. |
| Gemini diagnosis is offline | Confirm `GEMINI_API_KEY` exists only in the ignored root `.env`; invalid/unavailable keys intentionally produce read-only fallback and do not block the rest of the demo. |
| NVIDIA audit is skipped | This is expected unless `NVIDIA_API_KEY` is exported in the shell running `scripts/check-netmind.sh`. |
| Auth emulator cannot start | Confirm the Firebase CLI is installed and port `9099` is free, then restart the launcher. |

## Restart and cleanup

| Component | Recovery |
| --- | --- |
| PostgreSQL | `docker compose restart postgres`, wait for `docker compose ps`, then rerun the audit. Restart FastAPI only if its existing database connection does not recover. |
| API, frontend, Auth emulator, and controller | Stop `scripts/dev-netmind.sh` with `Ctrl-C`, then rerun it with `NETMIND_CONTROLLER_TOKEN` exported. It stops only the child processes it started. Local emulator tokens need to be refreshed after restart. |
| Controller only | Restart it from `simulation-controller` with the same `NETMIND_CONTROLLER_TOKEN`, then rerun the audit. Never expose its loopback port. |
| Optional NVIDIA diagnosis | Remove the exported key or let a timeout occur; the circuit breaker switches to deterministic read-only mode. Restore connectivity/key and retry a new question. |

To remove local database state intentionally, run `docker compose down -v`. This deletes the PostgreSQL volume; do not use it while preserving demo incidents or audit evidence matters.

## Repeatable recovery drills

1. Start an approved recovery action, terminate the controller process before confirmation, then start it again with the same token. Reconciliation rolls back an unconfirmed execution; retrying its idempotency key returns the original execution instead of issuing a duplicate action.
2. Restart PostgreSQL with `docker compose restart postgres`. Wait for its health check, rerun `bash scripts/check-netmind.sh`, and confirm the API and audit trail are available.
3. Run `python -m pytest backend/tests/test_nvidia_client.py backend/tests/test_recovery_execution.py`. The tests force provider failure/timeout fallback and controller-restart reconciliation, including no duplicate execution for an idempotency key.

If a controller action is still marked `executing` after a restart, do not issue another action manually. Start the API/controller, allow reconciliation to complete, inspect the audit trail, and only then request a new human-approved plan.
