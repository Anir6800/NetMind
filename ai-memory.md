# NetMind task memory

## NM-D1-S01 — Audit local Linux and network privileges

- Status: COMPLETE
- Started: 2026-10-22
- Scope: audit the local development environment and add automatic MININET/SIMULATED capability selection.
- Required evidence: `docs/setup/local-machine.md`, capability matrix, verification results, and safe Git commit.
- Observed: Windows 11, 25.5 GB RAM, Docker/Git/Node/Python/Firebase available; no root/CAP_NET_ADMIN, netns, OVS, Mininet, `tc`, `ip`, or `iperf3`; selected mode `SIMULATED`.
- Verification: `python scripts/probe_capabilities.py` passed; no application cloud hosting configuration exists.

## NM-D1-S02 — Initialize separate Git repository

- Status: COMPLETE
- Started: 2026-10-22
- Scope: repository ignore rules, README, architecture/audit/task documentation, and branch conventions.
- Verification: Python compile and capability probe passed; required files committed with a clean working tree.

## NM-D1-S03 — Create backend/frontend/controller folder tree

- Status: COMPLETE
- Started: 2026-10-22
- Scope: create the bounded frontend, backend, simulation-controller, infra, docs, scripts, and Stitch design tree with tracked README markers.
- Verification: required directory tree exists; Python compile and capability probe passed; committed with a clean working tree.

## NM-D1-S04 — Bootstrap FastAPI backend

- Status: COMPLETE
- Started: 2026-10-22
- Scope: FastAPI health endpoint, Pydantic settings, backend packaging, and health test.
- Verification: `pytest -q` passed (1 test); `ruff check app tests` and `ruff format --check app tests` passed.

## NM-D1-S05 — Bootstrap React frontend

- Status: COMPLETE
- Started: 2026-10-22
- Scope: Vite React TypeScript shell, routed overview page, TanStack Query provider, and local API client.
- Verification: `npm run build` passed; overview route is defined at `/`; frontend dependencies installed without vulnerabilities.

## NM-D1-S06 — Start local Postgres in Compose

- Status: COMPLETE
- Started: 2026-10-22
- Scope: loopback-only Postgres, SQLAlchemy session/model layer, and versioned Alembic baseline with least-privilege audit access.
- Verification: SQLAlchemy model import, Alembic offline SQL generation, ruff, and backend pytest passed. Live Compose health/migration is blocked because the Docker daemon is unavailable.

## NM-D1-S07 — Configure Firebase Auth emulator

- Status: COMPLETE
- Started: 2026-10-22
- Scope: demo-netmind Firebase emulator config, React local login client, backend token verification, role claims, and secured `/me`.
- Verification: backend pytest passed (5 tests, all four roles); ruff passed; frontend Vite build passed. Unsigned-token warning is documented for local test mode.

## NM-D1-S08 — Document and test startup paths

- Status: IN_PROGRESS
- Started: 2026-10-22
- Scope: local startup/check scripts, explicit loopback ports, and documentation of controller independence.
- Verification: backend pytest (5 passed), ruff, frontend build, and shell syntax checks passed. Live health scripts require local services; Docker daemon was unavailable.

## NM-D2-S01 — Approve shared Stitch design DNA

- Status: COMPLETE
- Started: 2026-10-22
- Scope: NetMind teal Soft Liquid Minimal design tokens, CSS handoff, and approved Stitch design reference.
- Verification: Stitch project and screenshot inspected; `tokens.json` parsed successfully; frontend Vite build passed with tokens imported.

## NM-D2-S02 — Document Stitch-to-React workflow

- Status: COMPLETE
- Started: 2026-10-22
- Scope: Stitch MCP/editor workflow, secure manual fallback, and reproducible React shell handoff.
- Verification: manual fallback steps recorded; source credential scan found no Stitch key pattern; frontend Vite build passed.

## NM-D2-S03 — Design Operations Overview in Stitch

- Status: COMPLETE
- Started: 2026-10-22
- Scope: canonical operations overview prompt with service health, live incident count contract, and empty/loading states.
- Verification: Stitch generation session completed; prompt documents data-bound health/incidents and three required states; frontend Vite build passed.

## NM-D2-S04 — Design Network Topology in Stitch

- Status: IN_PROGRESS
- Started: 2026-10-22

## NM-D2-S05 — Design Incident Center and Detail in Stitch

- Status: COMPLETE
- Started: 2026-10-22
- Verification: separate Stitch references and prompts recorded; shared action/evidence hierarchy defined; frontend build passed.

## NM-D2-S06 — Design AI Copilot and Recovery Center in Stitch

- Status: COMPLETE
- Started: 2026-10-22
- Verification: separate Stitch references/prompts recorded; approval gate checked; frontend build passed.

## NM-D2-S07 — Implement local responsive shell

- Status: COMPLETE
- Started: 2026-10-22
- Verification: accessible shell, skip link, focus styling, responsive navigation, and local theme switch added; frontend Vite build passed.

## NM-D2-S08 — Implement MVP route skeletons

- Status: COMPLETE
- Started: 2026-10-22
- Verification: eight route components are present and labeled SAMPLE; frontend Vite build passed.

## NM-D3-S01 — Implement typed network topology schema

- Status: COMPLETE
- Started: 2026-10-22
- Scope: versioned topology contract, six-node demo fixture, and invalid-graph validation tests.
- Verification: demo fixture validated; invalid endpoints and baseline links rejected; pytest (8 passed) and ruff passed.

## NM-D3-S02 — Build safe Mininet controller adapter

- Status: COMPLETE
- Started: 2026-10-22
- Scope: token-authenticated loopback JSON-RPC controller, allowlisted topology-validated commands, and subprocess safety checks.
- Verification: allowlist/idempotence/unknown-interface and no-shell tests passed; combined pytest (12 passed) and ruff passed.

## NM-D3-S03 — Implement simulation fallback mode

- Status: COMPLETE
- Started: 2026-10-22
- Scope: NetworkX simulated controller matching the privileged adapter contract and source-labeled path telemetry.
- Verification: shared controller contract and path-failure tests passed; pytest (15 passed), ruff, and frontend build passed; shell displays SIMULATED.

## NM-D3-S04 — Implement telemetry sampling service

- Status: COMPLETE
- Started: 2026-10-22
- Scope: bounded raw probes, timestamped source-labeled samples, and backend freshness/smoothing/retention.
- Verification: fixture and timeout probes, unknown/stale TTL, EWMA, and ring retention tests passed; combined pytest (19 passed) and ruff passed.

## NM-D3-S05 — Persist networks/incidents in PostgreSQL

- Status: COMPLETE
- Started: 2026-10-22
- Scope: constrained relational persistence, focused repositories, and clean-database migration/CRUD tests.
- Verification: isolated CRUD and empty-database migration tests passed; pytest (13 passed), ruff, and offline Alembic SQL checks passed.

## NM-D3-S06 — Add network and incident REST endpoints

- Status: COMPLETE
- Started: 2026-10-22
- Scope: typed, paginated API routers with repository services and OpenAPI contract coverage.
- Verification: isolated API tests cover valid data, 404, 422, and OpenAPI pagination contract; backend pytest (16 passed) and ruff passed.

## NM-D3-S07 — Render real topology in React Flow

- Status: COMPLETE
- Started: 2026-10-22
- Scope: API-driven React Flow topology, selected-device inspector, and explicit simulated source/update labels.
- Verification: topology API contract includes source/update metadata; backend pytest (16 passed), ruff, and frontend Vite build passed.

## NM-D3-S08 — Create controllable scenario injector

- Status: COMPLETE
- Started: 2026-10-22
- Scope: deterministic, allowlisted demo-topology fault injection with ground-truth records and an accurate local Lab view.
- Observed: `link_down`, `high_latency`, `packet_loss`, `congestion`, and `node_down` are deterministic, demo-topology-only scenarios; every start/stop retains a fault ID, type, location, seed, and wall/monotonic start/end times.
- Verification: backend pytest (15 passed), simulation-controller pytest (15 passed), repository ruff passed, and frontend Vite build passed. The fallback link-down test produced a reproducible `SIMULATED` incident candidate and an unreachable path until stopped.

## NM-D4-S01 — Implement deterministic incident rules

- Status: COMPLETE
- Started: 2026-10-22
- Scope: deterministic telemetry incident detection, topology correlation, deduplication, and a tested incident state machine.
- Observed: three consecutive breaches open link-loss, latency, or unreachable-host incidents; clear thresholds resolve after three samples; active link failures suppress dependent host symptoms; recent resolutions are flap-damped.
- Verification: backend pytest (26 passed), simulation-controller pytest (15 passed), repository ruff, and frontend production build passed.

## NM-D4-S02 — Build incident timeline and audit log

- Status: COMPLETE
- Started: 2026-10-22
- Scope: append-only hash-chained provenance events, incident timeline ordering, and tamper verification endpoint.
- Observed: every timeline append is canonical JSON hash-chained from the prior event; the verifier reports the first invalid event ID after payload tampering.
- Verification: backend pytest (30 passed, including migration and endpoint tampering), repository ruff, simulation-controller pytest (15 passed), and frontend production build passed.

## NM-D4-S03 — Create Gemini client adapter with fallback

- Status: COMPLETE
- Started: 2026-10-22
- Scope: server-only optional diagnosis adapter with deterministic offline fixture, resilience controls, and redacted metadata logging.
- Observed: plan amended to NVIDIA's OpenAI-compatible API. `NVIDIA_API_KEY` loads only from the ignored root `.env`; Nemotron is primary and Meta Muse fallback; the runtime enforces 40 RPM. Missing key, fixture mode, requests failures, and an open circuit return a clearly labelled `OFFLINE_FIXTURE` diagnosis.
- Verification: live JSON smoke tests succeeded for Nemotron (1.27 s) and Meta Muse (3.79 s); the adapter returned a structured Nemotron diagnosis in 8.94 s. Backend pytest (35 passed) and ruff passed. The key was not printed or committed.

## NM-D4-S04 — Define structured AI diagnosis schema

- Status: COMPLETE
- Started: 2026-10-22
- Scope: grounded diagnosis validation, deterministic probe-path fault localization, and provider explanation constrained to localized evidence.
- Observed: passed probe links are cleared before deterministic set-cover selection; diagnosis evidence, candidate links, and recommended action references are validated against server-provided sets. NVIDIA is constrained to explain the provider context, and typed `localizer_agreement` is available for the next API/UI task.
- Verification: malformed JSON/schema, unknown evidence, non-allowlisted actions, free-form commands, and links outside localization are rejected. Backend pytest (41 passed), simulation-controller pytest (15 passed), repository ruff, and frontend build passed.

## NM-D4-S05 — Build NetMind copilot question path

- Status: COMPLETE
- Started: 2026-10-22
- Scope: read-only grounded incident Q&A endpoint, execution-request refusal, and citation-aware copilot UI.
- Observed: copilot context is limited to the latest 20 immutable audit events for the requested incident; answers cite `audit:<id>` records. Execution-shaped prompts are refused locally before an NVIDIA call, and the UI labels cloud versus offline sources and renders 429/timeout feedback.
- Verification: endpoint citation and adversarial execution-prompt tests passed; backend pytest (44 passed), simulation-controller pytest (15 passed), repository ruff, and frontend production build passed.
- Amendment: NVIDIA Nemotron is requested as primary with Meta Muse as fallback, a 40-RPM client-side limit, and authorised live provider checks when a local key is present.
