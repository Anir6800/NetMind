# Task log

| Task | Status | Evidence |
| --- | --- | --- |
| NM-D1-S01 — Audit local Linux and network privileges | Complete | `capability-matrix.json`, setup documentation, commit `d75f39d` |
| NM-D1-S02 — Initialize separate Git repository | Complete | Required files, compile/probe checks, commit, and clean working tree |
| NM-D1-S03 — Create backend/frontend/controller folder tree | Complete | Required directory tree verified; compile/probe checks passed; README markers committed |
| NM-D1-S04 — Bootstrap FastAPI backend | Complete | FastAPI `/health`, Pydantic settings, pytest (1 passed), and ruff checks passed |
| NM-D1-S05 — Bootstrap React frontend | Complete | Vite production build passed; `/` overview route and local API client configured |
| NM-D1-S06 — Start local Postgres in Compose | In progress | Compose and Alembic baseline added; offline migration, ruff, and pytest pass; live DB check blocked by unavailable Docker daemon |
| NM-D1-S07 — Configure Firebase Auth emulator | Complete | Emulator config, local Firebase client, secured `/me`, four-role auth tests, ruff, and frontend build passed |
| NM-D1-S08 — Document and test startup paths | Complete | Loopback startup/check scripts, runbook, backend pytest/ruff, frontend build, and shell syntax checks passed; live services unavailable on host |
| NM-D2-S01 — Approve shared Stitch design DNA | Complete | Stitch design system/screenshot approved; teal dark/light tokens validated and frontend build passed |
| NM-D2-S02 — Document Stitch-to-React workflow | Complete | Secure MCP policy and no-key manual React shell fallback documented; credential scan and frontend build passed |
| NM-D2-S03 — Design Operations Overview in Stitch | Complete | Stitch canonical overview generated; true runtime incident-count contract plus loading/empty states recorded; frontend build passed |
| NM-D2-S04 — Design Network Topology in Stitch | Complete | Stitch topology reference and explicit canvas/legend semantics recorded; frontend build passed |
| NM-D2-S05 — Design Incident Center and Detail in Stitch | Complete | Separate Stitch handoffs preserve shared actions, timeline, and evidence hierarchy; frontend build passed |
| NM-D2-S06 — Design AI Copilot and Recovery Center in Stitch | Complete | Separate approval-gated Stitch handoffs preserve references, risks, and rollback; frontend build passed |
| NM-D2-S07 — Implement local responsive shell | Complete | Responsive sidebar/top bar/theme/status shell with keyboard focus and local-only assets; frontend build passed |
| NM-D2-S08 — Implement MVP route skeletons | Complete | Eight SAMPLE-only route skeletons and router entries added; frontend build passed |
| NM-D3-S01 — Implement typed network topology schema | Complete | Versioned six-node topology/addressing/baseline paths validated; invalid graph tests, pytest, and ruff passed |
| NM-D3-S02 — Build safe Mininet controller adapter | Complete | Token-gated loopback JSON-RPC, strict allowlist, topology validation, idempotence, and no-shell guard tested |
| NM-D3-S03 — Implement simulation fallback mode | Complete | NetworkX fallback shares controller contract, labels telemetry source, recomputes failed paths, and exposes SIMULATED badge |
| NM-D3-S04 — Implement telemetry sampling service | Complete | Bounded RTT/loss/jitter/throughput/interface probes and source-labeled freshness/EWMA/ring store tested |
| NM-D3-S05 — Persist networks/incidents in PostgreSQL | Complete | Constrained relational schema, repositories, isolated CRUD, and clean Alembic migration tests passed |
| NM-D3-S06 — Add network and incident REST endpoints | Complete | Typed repository-backed network/incidents APIs with filters, pagination, 404/422, and OpenAPI contract tests passed |
| NM-D3-S07 — Render real topology in React Flow | Complete | API-refreshed React Flow canvas, selected-device inspector, and source/update labels added; backend/frontend checks passed |
| NM-D3-S08 — Create controllable scenario injector | Complete | Demo-only deterministic scenarios record ground truth; fallback link-down produced a reproducible SIMULATED candidate; backend/simulation tests, ruff, and frontend build passed |
| NM-D4-S01 — Implement deterministic incident rules | Complete | Debounced/hysteretic deterministic detector, topology correlation, flap damping, severity scores, fully tested incident state transitions, and backend/simulation/frontend checks passed |
| NM-D4-S02 — Build incident timeline and audit log | Complete | Immutable canonical JSON SHA-256 hash chain, ordered incident event timeline, migration backfill, and tested tamper-detecting `/audit/verify` endpoint |
| NM-D4-S03 — Create Gemini client adapter with fallback | Complete | Plan amended to server-only NVIDIA OpenAI-compatible adapter with timeout, bounded retries, circuit breaker, structured output, redacted metadata, ignored `.env`, and deterministic offline fixture |
