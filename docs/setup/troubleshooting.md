# Troubleshooting local services

Run the local audit from the repository root after starting the stack:

```bash
bash scripts/check-netmind.sh
```

It fails fast when PostgreSQL, FastAPI, Vite, the Firebase Auth emulator, or the loopback simulation controller is unreachable. It checks the optional NVIDIA diagnosis API only when `NVIDIA_API_KEY` is exported; the application remains read-only and deterministic when that check is skipped or the provider is unavailable.

## Restart and cleanup

| Component | Recovery |
| --- | --- |
| PostgreSQL | `docker compose restart postgres`, wait for `docker compose ps`, then rerun the audit. Restart FastAPI only if its existing database connection does not recover. |
| API and frontend | Stop `scripts/dev-netmind.sh` with `Ctrl-C`, then rerun it. Its process-group trap cleans up its child processes. |
| Firebase Auth emulator | Stop `firebase emulators:start --only auth`, start it again, then rerun the audit. Local emulator tokens need to be refreshed after restart. |
| Controller | Stop only the independent controller process, then restart it from `simulation-controller` with the same `NETMIND_CONTROLLER_TOKEN`. Rerun the audit. Never expose its loopback port. |
| Optional NVIDIA diagnosis | Remove the exported key or let a timeout occur; the circuit breaker switches to deterministic read-only mode. Restore connectivity/key and retry a new question. |

To remove local database state intentionally, run `docker compose down -v`. This deletes the PostgreSQL volume; do not use it while preserving demo incidents or audit evidence matters.

## Repeatable recovery drills

1. Start an approved recovery action, terminate the controller process before confirmation, then start it again with the same token. Reconciliation rolls back an unconfirmed execution; retrying its idempotency key returns the original execution instead of issuing a duplicate action.
2. Restart PostgreSQL with `docker compose restart postgres`. Wait for its health check, rerun `bash scripts/check-netmind.sh`, and confirm the API and audit trail are available.
3. Run `python -m pytest backend/tests/test_nvidia_client.py backend/tests/test_recovery_execution.py`. The tests force provider failure/timeout fallback and controller-restart reconciliation, including no duplicate execution for an idempotency key.

If a controller action is still marked `executing` after a restart, do not issue another action manually. Start the API/controller, allow reconciliation to complete, inspect the audit trail, and only then request a new human-approved plan.
