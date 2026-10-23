# Services

Application use cases and orchestration services.

Recovery policy validation is deterministic and executor-free: it checks permissions, freshness, expiry, cooldown, rollback readiness, bounds, and a topology what-if before approval.

Approval transactions bind plan hash, approver, expiry, and nonce with the backend-only `approval_hmac_key`; consumption is one-time and committed transactionally.

Recovery execution requires a consumed approval, serializes one active action per network, audits transitions, and rolls back unconfirmed actions. The current controller adapter executes only approved `restore_link` operations.

Recovery verification requires consecutive healthy probes within a bounded window, using loss and 120%-of-baseline RTT thresholds. It stores MTTD/MTTR and rolls back failed actions.
