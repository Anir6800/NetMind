# NetMind v0.1.0 team handoff

Release baseline: annotated local tag `v0.1.0`. Current repository maintainer: **Aniruddh Rathod**. The maintainer assigns a named teammate to each role below before changing that module; until then, the maintainer is the escalation owner.

## Module ownership

| Module | Owner role | Handoff responsibility |
| --- | --- | --- |
| `frontend/` | Frontend owner | Preserve source/freshness labels, accessibility, and the approval gate; run E2E and build before merging. |
| `backend/app/`, `backend/tests/`, migrations | Backend owner | Maintain API/schema compatibility, audit integrity, auth/role checks, and migration coverage. |
| `simulation-controller/`, `data/topologies/` | Controller owner | Keep loopback binding, token checks, typed allowlist, and no-shell boundary intact; validate any privileged adapter on Linux. |
| `docs/setup/`, `docs/demo-script.md`, `docs/evidence/` | Demo and operations owner | Keep the second-member startup path, live-versus-fixture distinction, and recovery evidence current. |
| `infra/`, `compose.yaml`, `scripts/` | Local platform owner | Keep services local-only and make startup/check/cleanup scripts agree with actual ports. |
| `design/` | UX owner | Keep proposal, approval, execution, and rollback states distinguishable; never imply automatic action. |

## v0.1.0 scope boundary

Included: local topology and incident views, deterministic simulated fallback, source/staleness labels, evidence-bound read-only diagnosis, human approval requests, typed controller recovery, and verified/rolled-back recovery states.

Not included: cloud deployment, multi-user production operations, public controller access, autonomous network changes, unlabelled live claims, ML-driven actioning, RAG over external documents, or production analytics/SLO reporting. A Simulation Lab selection is not a browser-issued controller command.

## Open risks and required handling

| Risk | Current control | Owner / next action |
| --- | --- | --- |
| No live stack proof on a host without Docker Desktop's Linux engine | Documentation does not claim a live run; fixture captures are labelled. | Demo and operations owner: run `bash scripts/check-netmind.sh` on the presentation host and retain the output. |
| Privileged Mininet behavior is host-specific | Controller stays separate, loopback-only, token-gated, and uses typed allowlisted actions. | Controller owner: test under a dedicated Linux account; never expose port `8765`. |
| Cloud diagnosis key/provider failure | Keys stay in ignored `.env`; failures fall back to read-only deterministic output. | Backend owner: confirm outage banner and no-action behavior after provider changes. |
| Fixture screenshots could be mistaken for controller evidence | Screens use `SIMULATED`, `OFFLINE_READ_ONLY`, or `STALE` labels. | Demo owner: record raw incident/audit output for any live recovery claim. |
| Local database cleanup destroys demo history | `docker compose down -v` is explicitly destructive. | Platform owner: use `docker compose stop postgres` unless intentional reset is approved. |
| Large production frontend bundle | Vite reports a bundle-size warning. | Frontend owner: measure route-level code-splitting before adding heavyweight V1 views. |

## First-run handoff checklist

1. Read [operations.md](setup/operations.md), install the listed dependencies, and keep Docker Desktop running.
2. Set `NETMIND_CONTROLLER_TOKEN` interactively; never commit or print it.
3. Start with `bash scripts/dev-netmind.sh`, then run `bash scripts/check-netmind.sh` in a second terminal.
4. Follow [demo-script.md](demo-script.md); preserve the source/failure labels shown by the UI.
5. Before a code handoff, run frontend E2E/build and backend tests. For a live-demo claim, attach the target host's health-check output as evidence.

## Verification record — 2026-10-23

- Frontend fixture E2E: 2 passed.
- Frontend production build: passed.
- Backend suite: 125 passed.
- Live controller validation remains a target-host prerequisite because this workstation lacks a running Docker Desktop Linux engine.
