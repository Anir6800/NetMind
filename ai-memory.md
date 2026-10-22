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
