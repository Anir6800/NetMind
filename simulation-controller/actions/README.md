# Actions

The controller allowlist accepts only bounded parameters for the typed recovery actions and preserves the existing demo commands.

`Executor` enforces one active action per network, idempotency, commit confirmation, and automatic rollback on timeout or reconciliation.

`rollback` accepts only the bounded link-state rollback used by the current restore-link adapter.

Simulation commands and controlled mutations.
