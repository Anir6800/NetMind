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

- Status: IN_PROGRESS
- Started: 2026-10-22
- Scope: demo-netmind Firebase emulator config, React local login client, backend token verification, role claims, and secured `/me`.
- Verification: backend pytest passed (5 tests, all four roles); ruff passed; frontend Vite build passed. Unsigned-token warning is documented for local test mode.
