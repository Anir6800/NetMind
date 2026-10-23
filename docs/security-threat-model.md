# Security threat model

## Prompt and evidence boundaries

Telemetry, hostnames, syslog text, and retrieved audit payloads are untrusted data. They can be used as evidence citations but never as authority to execute commands, alter policy, or create recovery actions.

The copilot refuses direct execution requests and, when cloud diagnosis is unavailable, emits only a deterministic read-only summary. Provider output is validated against the stored evidence ID set, topology candidates, and the action allowlist; unknown evidence IDs and non-allowlisted actions are rejected.

`test_prompt_security.py` exercises 22 payloads across direct prompts and indirect hostname/syslog/telemetry fields. The expected pass rate is 100%: zero fabricated evidence IDs and zero unvalidated actions.

## Recovery boundaries

Recovery execution requires a validated plan, distinct authorized human approval, a one-time signed nonce, deterministic policy checks, and post-action verification with bounded rollback. The browser cannot send controller commands directly.
