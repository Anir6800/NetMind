# NetMind V1 backlog

These are V1 candidates, not v0.1.0 commitments. They must preserve the local-only, evidence-bound, human-approved recovery boundary described in [HANDOFF.md](HANDOFF.md).

## Priority order

| Priority | Feature | Scope and dependency | Done when |
| --- | --- | --- | --- |
| 1 | ML anomaly detection | Advisory detector over retained source-labelled telemetry. Requires a versioned training/evaluation dataset, baseline rule comparison, drift checks, and false-positive review. | It emits a labelled anomaly with evidence and confidence, is evaluated against deterministic rules, and cannot propose or execute a controller action. |
| 2 | Retrieval-augmented diagnosis (RAG) | Read-only retrieval over approved local runbooks, topology records, and immutable audits. Requires document provenance, role-aware access, citations, prompt-injection tests, and offline behavior. | Every answer cites retrieved source IDs, refuses unsupported operational instructions, and keeps the existing approval workflow unchanged. |
| 3 | Advanced analytics | Read-only trend views for availability, loss, latency, incident counts, MTTD/MTTR, and recovery outcomes. Requires timestamped source-labelled samples and explicit retention policy. | Each metric shows its calculation window, source, missing/stale state, and filters; no chart implies live or causal data without evidence. |

## Non-negotiable V1 guardrails

- ML and RAG outputs are hypotheses, not authority to operate the network.
- Any action remains typed, policy-validated, human-approved, controller-side, verified, and rollback-capable.
- Keep controller and provider credentials out of prompts, retrieval corpora, telemetry, screenshots, and Git.
- Preserve local/loopback deployment until a separate security, authentication, tenancy, and data-retention design is approved.
- Add tests and evidence for failure paths before presenting a feature as a demo capability.

## Deferred work

- Real Mininet adapter hardening on a dedicated Linux host with `CAP_NET_ADMIN`.
- Hosted/multi-user deployment, secret management, observability, backup, and incident retention policy.
- Alert routing, scheduled reports, comparative topology analytics, and export formats.
- Performance work after measurements, including route-level splitting if the frontend bundle remains material.

## Suggested first V1 iteration

1. Define the telemetry retention schema and capture a small labelled fault corpus from the deterministic scenarios.
2. Ship analytics as read-only source-labelled tables before charts or ML.
3. Add the advisory anomaly baseline and evaluate it against the existing deterministic detector.
4. Add local-only RAG only after the citation and injection test harness exists.

The next owner should create a separate task and acceptance tests for each item; none should be bundled into a recovery-control change.
