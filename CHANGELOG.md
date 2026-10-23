# Changelog

All notable changes to this local-only college project are recorded here.

## v0.1.0 — 2026-10-23

### Added

- Local operations handbook covering loopback ports, controller safety, diagnosis-provider keys, and cleanup.
- Fixture-backed UI evidence for topology, incidents, diagnosis, approval, stale telemetry, verified recovery, and rollback.
- Evidence-bound copilot, human approval gate, typed recovery workflow, and verification/rollback state handling.

### Verification

- Frontend fixture E2E: 2 passed.
- Frontend production build: passed.
- Backend suite: 125 passed.

### Limits

- This is a local-only release. A controller-backed demo requires Docker Desktop's Linux engine and must be validated with `bash scripts/check-netmind.sh` on the target host.
- Fixture captures are labelled simulated/offline/stale where applicable and are not proof of a live controller action.
