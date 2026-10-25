# NetMind task memory

## NM-RUN — One-click Windows run and demo handoff

- Status: COMPLETE WITH ENVIRONMENT LIMITS
- Started: 2026-10-23
- Scope: add Windows start/stop scripts, a local-only demo setup path, and runnable demo documentation without changing product behaviour.
- Observed: actual services use PostgreSQL `5432`, API `8000`, Vite `5173`, Firebase Auth/UI `9099`/`4000`, and token-gated controller `8765`; Windows capability probe selects `SIMULATED`. `run.ps1` and `stop.ps1` parse successfully. `stop.ps1` with no launcher state reported that unrelated processes were not touched. `run.ps1 -Check` correctly reported an unrelated `postgres` PID occupying port `5432` and gave the safe remediation.
- Verification: frontend E2E passed (2 tests), frontend production build passed, and backend suite passed (125 tests). Full clean run, Firebase seeding, browser login, live controller/recovery path, Docker-stopped check, and launcher-managed shutdown are NOT RUN: this workstation has an unrelated PostgreSQL listener on `5432`, and Docker Desktop's Linux engine was unavailable earlier in this task. The demo guide explicitly documents existing product boundaries: current Lab UI does not send a fault and recovery execution API returns 501; no live path is claimed. Follow-up found an unrelated NeuroRoute Vite process on `5173`; the launcher now reports it and safely falls back to `5174` rather than stopping it. After the local PostgreSQL service was stopped, `run.ps1 -Check -NoBrowser` passed on 2026-10-23.

- Follow-up: launcher key setup now detects an existing ignored `NVIDIA_API_KEY` and skips the Gemini prompt; it prompts only when neither optional provider key exists.
- Follow-up: Firebase emulator role seeding was corrected from an unsupported REST `customAttributes` update to the Firebase Admin SDK against the local emulator. The prior launcher run reached healthy PostgreSQL before that seeding request failed; it was then cleaned up by the tracked stop path.
- Follow-up: a real launcher run started the full local stack, but topology/incidents returned 500 because `netmind_app` lacked privileges on tables created after the original audit migration. Migration `0007_grant_app_permissions` grants the existing restricted role DML/sequence access without widening the browser/controller boundary.
- Follow-up: after permissions were fixed, the fresh database correctly returned 404 for `/networks/1/topology` because no demo network record was seeded. The launcher now idempotently seeds the fixture-backed network `id=1` and its devices after migrations.
- Follow-up: user requested populated demo data. The local seed now creates 100 explicitly named SIMULATED incidents with source-labelled detection audit events; the UI requests up to 100 and labels this list as simulated demo data.
- Follow-up: `run.ps1` now detects a running NetMind Compose PostgreSQL container on `5432` and reuses it instead of treating Docker's port forward as an unrelated conflict. Verified against `netmind-postgres-1` on 2026-10-24.
- Follow-up: the launcher starts only Firebase Auth, so its health check no longer waits for the optional emulator UI on `4000`; the Auth emulator remains on `9099`.
- Verification update: on 2026-10-24, `run.ps1 -NoBrowser` completed successfully after the Docker reuse/UI health-check fixes. API health returned `ok`; frontend returned HTTP `200`; Firebase Auth (`9099`) and controller (`8765`) listened; PostgreSQL contained 100 seeded SIMULATED demo incidents.

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

## NM-D7-S04 — Complete security and permission gates

- Status: COMPLETE WITH RELEASE BLOCKER
- Started: 2026-10-23
- Scope: security/permission acceptance gates, source and dependency audits, local-controller binding/no-shell checks, and MVP fixture verification.
- Observed: protected approval/execution, allowlisted recovery policy, verified rollback, loopback-only controller binding, raw-shell rejection, secret-pattern scan, Python dependency audit, source security lint, frontend build, and fixture E2E passed. Production workflow assertions were changed to runtime validation so the security guard survives Python optimisation.
- Blocker: `npm audit --omit=dev --audit-level=high` found four high-severity transitive Firebase/@grpc/grpc-js advisories. npm proposes a breaking forced Firebase downgrade; it was not applied. `docs/acceptance/netmind-mvp.md` explicitly records the overall gate as FAIL pending a compatible dependency remediation.
- Verification: backend security/recovery suite (35 passed), full backend suite (125 passed), controller suite (19 passed), `ruff check --select S app`, full backend ruff, `pip-audit -r backend/requirements.lock` (no known vulnerabilities), frontend production build, and Playwright fixture E2E (1 passed).

## NM-D7-S05 — Capture UI and lab demo evidence

- Status: COMPLETE
- Started: 2026-10-23
- Scope: reproducible, fixture-backed captures of simulated lab/topology, incident evidence and diagnosis, approval gate, offline/read-only and stale labels, verified recovery, and rollback.
- Observed: eight PNGs were generated in `docs/evidence/screenshots/` by `CAPTURE_UI_EVIDENCE=1 npm run test:e2e`. Every non-live state is visibly labelled; the evidence README and demo script explicitly state these are local API-shaped fixtures, not proof of a live controller run.
- Verification: capture-mode Playwright E2E (2 passed); normal Playwright E2E (2 passed); frontend production build passed (existing >500 kB chunk warning only).

## NM-STUDENT-SIM — Redesign as a student network simulator

- Status: COMPLETE
- Started: 2026-10-24
- Scope: Replace the incident-first console with student login, saved/custom/generated topologies, 50-device labs, routing and packet simulation, realistic calculated timing, fault preview/confirmation, slow replay, logs, and an explain/suggest assistant.
- Observed: the live local flow signed in as the seeded student, generated and persisted a 50-device OSPF campus lab, selected the midpoint link fault, previewed a 53.451 ms alternate path over the 10 Mbps backup, and confirmed execution. The event log recorded the 5000 ms OSPF convergence model and the changed route; the browser console had no errors or warnings.
- Verification: full backend suite 129 passed; changed backend files passed Ruff; frontend production build passed with the existing >500 kB chunk warning; Playwright smoke test 1 passed; live browser generation, preview, confirmation, and timing/log display passed against PostgreSQL and the Firebase emulator.
- Limits: routing and protocol behavior is an educational `SIMULATED` calculation, not a discrete-event implementation or physical packet capture. `SIMULATED_AI_PLANNER` is deterministic and local; it does not call NVIDIA/Gemini for topology generation.
- Correction (2026-10-24): fixed a live PostgreSQL 500 when deleting the seeded demo network. The ORM now uses database-compatible device cascade deletion. Verified network 4 loads, adding a router changes 6/50 to 7/50, fault preview reroutes over the backup path, and a generated six-device network completed create/load/delete with HTTP 204. API tests: 10 passed; browser console: no errors or warnings.
- Manual-builder correction (2026-10-24): added a visible `Create blank network — build it myself` workflow. Empty topology documents are now valid, the simulator handles zero nodes safely, and Preview remains disabled until a meaningful source, destination, and target exist. Live verification created an empty 0/50 canvas, added a router, saved it to PostgreSQL, reloaded, and retained the router. Focused backend tests: 16 passed; frontend production build passed.

## NM-STUDENT-SIM — AI generation and interactive canvas correction

- Status: COMPLETE
- Started: 2026-10-24
- Scope: enable configured NVIDIA topology intent parsing, redesign navigation/canvas, animate simulated traffic, and make right-click device/link state changes recalculate impact.
- Observed: a live API request interpreted a 14-device hospital/RIP prompt through NVIDIA and returned `source=NVIDIA`; the generated graph remains server-validated and deterministic. The browser rendered the floating bottom pill, rounded device cards, animated link traffic, and a right-click link menu. Setting a link down immediately displayed before/after delay, reachability, route dependency, and a `LIVE` event-log entry with zero browser errors.
- Verification: full backend suite 132 passed; Ruff passed; frontend production build passed with the existing >500 kB chunk warning. Browser smoke covered right-click state change and automatic impact calculation against the running local stack.
- Limits: traffic and timing are labelled `SIMULATED`; this is an educational calculator, not packet capture. NVIDIA interprets topology intent while the allowlisted local builder creates the validated graph. One device can be held down through the immediate canvas control at a time; use the scenario preview for other concurrent what-if faults.

## NM-SIM-CONTINUE — Finish NetMind as a student network simulator

- Status: COMPLETE
- Started: 2026-10-24
- Scope: Step 0 reconcile, then WP1 live canvas, WP2 discrete-event engine, WP3 routing/convergence, WP5 AI, WP6 UI, WP9 partial, WP4 protocol ladders, WP7 templates/criticality, WP8 save/share/lessons, final WP9.
- Step 0 (reconcile): the "12 uncommitted files" from the cut-off session were already committed as `46dbc3b` (same 12 files: README, ai-memory, networks API/service, nvidia_client, AppShell, Dashboard, Simulator, global.css, run.ps1, tests). Working tree clean; no stale IN_PROGRESS entry for that work (its entry above says COMPLETE). Checkpoint SHA = `46dbc3b`; no new checkpoint commit was needed.
- Step 0 checks (2026-10-24): backend pytest 132 passed; ruff clean; frontend build passed (>500 kB chunk warning only). `run.ps1` already sets `NETMIND_NVIDIA_FIXTURE_MODE=false` when `NVIDIA_API_KEY` is non-empty.
- Finding: the route calculator is a component-local function in `frontend/src/pages/Simulator.tsx`; templates are 20 category labels fed to one tree generator in `backend/app/services/networks.py`.
- Step 0 browser smoke (Playwright headless against the already-running stack, 2026-10-24; Chrome extension was disconnected): demo student login worked; network 3 loaded 50 devices. Right-click LINK opened Set down/Restore/Delete; Set down produced the before/after card and a `LIVE` log entry. Right-click DEVICE opened Set down/Restore/Rename/Delete; Set down logged `LIVE · node host-6 changed DOWN`. Console: 0 errors/warnings. Bugs seen: context menu is not clamped to the viewport (Playwright reported its buttons outside viewport); bottom pill overlaps the canvas; header shows `Network 3` instead of the saved name when networks list loads late.
- Step 0 AI probe: live `POST /networks/generate` returned `source=NVIDIA`, 12 devices, RIP in 1.16 s (key present, fixture mode false). Probe network deleted (HTTP 204).
- WP1 (live canvas) DONE 2026-10-24:
  - Files: `frontend/src/sim/engine.ts` (single calculator: L3 adjacency through L1/L2 segments, per-prefix static/RIP/OSPF tables, LPM forwarding, TTL, firewall ACL, M/M/1/K queue estimate, `applyFault`, `compareImpact`), `sim/engine.test.ts` + `sim/testkit.ts` (run `npm test`, Node 24 native TS), `features/sim/canvas.tsx` (symbol cards, SMIL traffic edges, reduced-motion arrows), `features/sim/panels.tsx` (before/after card, inspectors, palette, legend), `pages/Simulator.tsx` rewritten (topology is the single state, undo/redo, search-focus, minimap, snap grid, multi-select, right-click device/link/canvas menus, Shift+F10 keyboard menu), `AppShell.tsx` pill nav (Networks/Canvas/Simulate/Tables/Logs/AI), new `global.css`/`tokens.css`. Removed unrouted incident/copilot/telemetry pages and API client functions. Backend schema: optional node `name/state/acl`, link `length_m/queue_packets/utilisation_pct/ospf_cost`.
  - Observed: engine unit tests 12/12 (incl. hand-calculated ping 6.325088 ms, 1500 B/10 Mbps/2 km t_tx 1.2 ms t_prop 0.01 ms, Preview==live equality). Playwright `e2e/simulator-live.spec.ts` 1 passed against the running stack: right-click link down and device down each showed the before/after card in < 1 s; live link-down numbers equal a Preview of the same fault; device-down reachable devices 4 → 0, restore → 4; no console errors/warnings. OSPF reroute one-way 14.974 ms matches hand calculation. Backend 132 passed, ruff clean, build passed.
  - Launcher: first restart failed waiting 45 s for Firebase (NOT root-caused; measured cold start 6.7 s afterwards, second run healthy). Firebase wait raised to 120 s and the failure message now points at the real log names.
- WP1 commit: `5cdf7db`.
- WP2 (slow-motion engine) DONE 2026-10-24: `frontend/src/sim/des.ts` (event queue + virtual clock, explicit FIFO tail-drop, seeded loss/jitter, cold ARP, switch MAC learn/flood, hub repeat, router LPM/TTL text, ICMP time exceeded, CSV export), `des.test.ts` (8 tests), `features/sim/playback.ts` (external clock store; only edges carrying packets re-render), `features/sim/player.tsx` (player dock 0.1x–10x/pause/step/scrubber, packet list, layer view, per-hop formula table, filterable run log with CSV/JSON export), `docs/sim_model.md`, `e2e/helpers.ts`, `e2e/slow-motion.spec.ts`.
  - Observed: unit tests 20/20 (DES unloaded timing == analytical; 1500 B/10 Mbps/2 km = 1.41 ms delivered incl. 2×0.1 ms host processing). Playwright 3/3 passed; at 0.25x the packet was sampled on l1 → l2 → l3 in order with an advancing clock; screenshot showed packet #1 on l3 with the t_tx/t_prop event text. Cold-ARP first ping one-way 18.756 ms vs reply 6.325 ms (= analytical).
- WP2 commit: `20d0a33`.
- WP3 (routing + convergence) DONE 2026-10-25: `frontend/src/sim/convergence.ts` (RIP distance-vector event sim with periodic/triggered/invalid/flush, split horizon+poison reverse toggle, count-to-infinity flag; OSPF hello/dead detection, LSA flooding, per-router LSDB, two-way check, SPF delay; static never converges; flow outage replay; traceroute), `convergence.test.ts` (8 tests), engine refactor (`prefixOwners` withdraws connected routes of dead interfaces, `routesFrom`, `shortestFrom` exported; RIP metric 16 = no route in forwarding), `features/sim/tables.tsx` (route table diff added/changed/removed, learned ARP/MAC tables from last run, convergence timeline + Static/RIP/OSPF compare, traceroute), Tables drawer rewired, aria-labels on drawer selects (accessible names previously included every option's text), Playwright actionTimeout 8 s.
  - Observed: unit tests 28/28. Lab l3 failure: OSPF detect 0, converged 206.9 ms, outage 200 ms, 20 packets lost @100 pps; RIP converged 9.47 s, outage 8.41 s, 841 lost; static never/permanent. Dead-timer detection behind a switch at 30–40 s. Count-to-infinity appears for some seeds without split horizon/triggered updates and never with defaults (seeds 1–10). Playwright 4/4 passed incl. `e2e/tables.spec.ts` (row-changed 10.0.2.0/24 via r3, row-removed 10.0.12.0/30, 3-row comparison, 4-hop traceroute h1→r1→r3→r2→h2).
- WP3 commit: `1e31ed7`.
- WP5 (AI) DONE 2026-10-25: provider confirmed in code = NVIDIA OpenAI-compatible API (`nvidia/nemotron-3-ultra-550b-a55b`, fallback `meta/muse-glimmer-30b`), key only in ignored root `.env`. `nvidia_client.py`: explicit `mode()` (LIVE / LOCAL_RULES + reason), `complete_json` (per-call timeout, 3-attempt retry budget across primary+fallback, circuit breaker, 40 RPM limiter, no key in logs), process-wide `get_ai_client()`. New `services/topology_builder.py` (NetworkSpec, deterministic builder for 6 layout styles, `repair_spec` (clamp / shrink to 50), `validate_lab` (≤50, unique names/IPs, connected, sane links), local rule-based planner), `services/assistant.py` (generate: form→no AI, prompt→LIVE spec JSON quoted-untrusted prompt, repaired or rejected with readable note → labelled local fallback; explain: grounding check rejects numbers not in the simulator facts; suggest: allowlisted actions validated against the topology), `api/ai.py` (/ai/status, /ai/explain, /ai/suggest), `/networks/generate` now returns source/answered_by/notes/summary and 422 on invalid labs. `tests/conftest.py` forces fixture mode + clears caches so tests never call the live provider (settings read the real .env). Frontend: `sim/edit.ts` (connect, applySuggestion), `features/sim/ai.tsx` (status, explain, suggest → preview → confirm), dashboard prompt + detailed form, impact card generic apply action, compareImpact(protocolAfter).
  - Startup flag: run.ps1 already sets `NETMIND_NVIDIA_FIXTURE_MODE=false` when a key exists (fixed in 46dbc3b); verified /ai/status = LIVE.
  - Observed (LIVE run, 2026-10-25, key present): /ai/status LIVE; generate "three-floor college network with 45 devices, OSPF, one firewall" → source NVIDIA, 45 devices / 57 links, 11.9 s; prompt-injection request → NVIDIA ignored it, 20-device validated RIP lab; explain → accepted (grounded), 2.8 s; suggest → restore/add_link/set_protocol, 5.7 s. Playwright `e2e/ai.spec.ts` passed against LIVE AI: answers labelled, preview left 7 links, apply → 8 links and destination reachable. Mocked-provider tests: valid, invalid JSON, schema violation, >50 devices, injection, form bypass, circuit/no key in logs, grounded vs invented numbers, suggestion validation. Backend 144 passed, ruff clean; unit 28/28; Playwright 5/5. Probe networks 25, 26 deleted.
  - Environment: Docker Desktop had stopped; started it from `%LOCALAPPDATA%\Programs\DockerDesktop`.
- WP5 commit: `a22a41c`.
- WP6 (UI) DONE 2026-10-25: minimap was empty because controlled React Flow nodes dropped `dimensions` changes — sizes now carried back as `measured`; edge hover labels; keyboard selection opens the inspector; Shift+F10 menu; "Connect to" changed to select + Connect button (arrowing through the old select connected every device passed over — found by the keyboard test); palette buttons lost a wrong role="listitem"; refit on window resize (laptop → projector); player close button; builder layout wraps tiers at 12 cards (29 end devices previously overlapped in one row). Incident seeding was already removed (e790229); unrouted incident pages removed in WP1.
  - Observed: `e2e/ui.spec.ts` keyboard-only blank network → 2 routers + 2 hosts → connect → source/destination → path PC1 → R1 → R2 → PC2 → Shift+F10 power down R2 (dropped) → Restore (reachable), 0 console errors. Performance: 50 devices, 61 links, 5 flows, playback at 1x: 60.4 / 59.9 / 60.2 fps across runs (target ≥ 30). Screenshots at 1366×768 and 1920×1080 reviewed. prefers-reduced-motion: dots hidden, static arrows shown. Playwright 8/8 with workers=2 (5 parallel workers timed out on API POSTs while other test processes ran; pinned workers: 2).
- Parallel workflow (ultracode) built pure modules with build → adversarial review → fix: `sim/protocols.ts` (+8 tests), `sim/analysis.ts` (+9 tests, tie rule and link names fixed by lead), `backend/app/services/templates.py` (25 prepared labs), `scripts/export_templates.py`, `data/templates/*.json`, `backend/tests/test_templates.py`, `frontend/src/sim/templates.test.ts` (routes sample pairs in every template under static/RIP/OSPF). Not yet committed: needs UI integration in WP4/WP7.
- WP6 commit: `68a52ac`.
- WP9 partial DONE 2026-10-25: README rewritten (student quick start, feature table, viva "how it works", AI honesty, verification commands, ports). run/stop scripts unchanged apart from the WP1 Firebase wait fix.
- WP9 partial commit: `4e3cef9`.
- WP4 (protocol scenarios) DONE 2026-10-25: `sim/protocols.ts` (workflow-built, reviewed: ICMP, ARP, DHCP DORA, DNS + cache, TCP handshake/slow start/RTO retransmission/teardown, UDP, HTTP; timing from engine forward+pathMetrics; failures mid-scenario; simplifications listed per ladder), `protocols.test.ts` (8), `features/sim/ladder.tsx` (SVG sequence diagram beside the canvas), Simulate drawer "Protocol scenario" section with optional mid-scenario fault, engine exports toInt/toIp (dedupe), `e2e/protocols.spec.ts`.
  - Observed: TCP h1→h2 with l3 down at 20 ms under static: SYN/SYN-ACK/ACK at 0 → 6.315 → 12.631 ms, data lost, retransmits at 1.026 s, 3.026 s, 7.026 s, "Connection reset after 3 retransmissions"; under OSPF the same fault completes. Playwright protocols + live specs 2/2.
- WP4 commit: `9ecec68`.
- WP7 (topologies + criticality) DONE 2026-10-25: `sim/analysis.ts` (+9 tests), `backend/app/services/templates.py` (25 templates), `GET /networks/templates`, template generation → source TEMPLATE "Prepared template (no AI)", `scripts/export_templates.py`, `data/templates/*.json`, `backend/tests/test_templates.py`, `frontend/src/sim/templates.test.ts` (76 routing checks: sample host pairs in every template under static/RIP/OSPF). UI: dashboard cards from the API (description, size, protocol, style), SPOF badges on devices and bridge links, critical list + busiest middle device in the Canvas drawer, dependency view (upstream/downstream/flows by layer) and link failure impact in the inspector, AI Suggest now receives real articulation points/bridges. Fixed stale network-name fallback (showed "Network 53" for a just-generated lab).
  - Observed: backend 173 passed, ruff clean; unit 121/121; Playwright templates + UI specs 4/4 (25 cards; Small office opens as TEMPLATE with its name; SPOF list "if … fails, N devices lose reachability"; SW1 dependency view "7 devices lose reachability", upstream R1; 50-device fps 60.3 with SPOF analysis on).
- WP7 commit: `e236399`. Status dot (user request mid-task) commit `ff8c458`: /health reports database + AI mode; pill dot red/yellow/blue/green; e2e status-dot.spec.ts.
- WP8 DONE 2026-10-25: workflow-built + reviewed `sim/lessons.ts` (5 lessons, checks over LessonState, shortcut tests after review found two lessons completable without the lesson's point), `POST /networks/import` (validate_lab except connectivity, readable 422, unique name " (2)"), `POST /networks/{id}/duplicate` ("(copy)", "(copy 2)"), `tests/test_import_export.py`. UI: dashboard guided labs (start = template network + lesson panel), Duplicate/Export per saved network, Import .json, simulator Export, autosaved drafts in localStorage with restore/discard banner (cleared on Save), lesson panel. Fixed: pill links dropped other query params (lesson closed when switching drawers).
  - Observed: backend 177 passed; unit 127/127; Playwright lessons spec 2/2 (find-the-spof loads the office template ids, progresses 0/4→1/4→2/4→3/4→complete; UI export → import topology deep-equal).
- WP8 commit: `dab986b`; e2e selector fix `dfaecc9`.
- Tutorial (user request mid-task) DONE 2026-10-25: `components/layout/Tour.tsx` spotlight tour (dashboard 7 steps, simulator 12 steps covering create/drag/connect, right-click real-time before/after, simulate, preview, slow motion, tables/convergence, logs, AI, save/undo/export, find). Auto-runs once per browser for new users, Skip / Back / Next / Esc / arrow keys, "?" in the pill replays it. Simulator steps open the matching drawer. E2E helper marks the tour as seen; `e2e/tour.spec.ts` covers it.
- FINAL WP9 (2026-10-25): backend 177 passed, ruff clean; frontend unit 127/127; build passed (only the existing >500 kB chunk warning); Playwright 14/14 (13 specs files) against the running stack with LIVE AI; 50 devices/61 links fps 60.2–60.4; `run.ps1 -Check` on the running stack reports idempotent "already running". In the last full run the LIVE model returned malformed JSON for Suggest and the server correctly fell back to the labelled local planner.
- Status: NM-SIM-CONTINUE COMPLETE. Known limits: see README / docs/sim_model.md "Not modelled"; lesson tcp-retransmit cannot verify the "same fault" mid-scenario (uses a live link-down instead); spanning tree, VLANs, NAT, collisions and full TCP not modelled; 25 templates use one deterministic builder (layout styles differ, not hand-drawn).
