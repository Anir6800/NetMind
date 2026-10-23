# Cloud API outage mode

When the configured cloud diagnosis provider is unavailable or its circuit breaker is open, NetMind switches to deterministic read-only mode. The summary is derived only from immutable audit evidence, displays an outage banner, and supplies a safe manual runbook.

Outage mode never proposes or invokes a recovery action. Operators must review telemetry and audit evidence, then use the normal human approval workflow for any recovery plan.
