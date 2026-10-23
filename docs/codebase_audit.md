# Codebase audit

Date: 2026-10-23

## Dependency and secret review

- `backend/requirements.lock` pins the runtime and development dependency closure resolved from `backend/pyproject.toml`; `frontend/package-lock.json` is present and pins the Node dependency tree.
- No credential-bearing `.env`, service-account JSON, PEM, key, or P12 files are tracked. The tracked configuration references variable names only. Local `.env` remains ignored.
- `python -m pip check` reports no broken installed requirements.

## Known limits and follow-up bugs

1. `GET /telemetry/latest` returns no metrics until a controller collector feeds the in-memory telemetry store. It correctly avoids inventing live values, but collector-to-backend transport is not implemented.
2. `simulation-controller/topology/controller.py` only derives state keys for legacy link/netem commands. Newly allowlisted typed commands such as `restore_link` need state-key support before they are sent through the direct JSON-RPC controller; current recovery tests use the bounded adapter contract instead.
3. The Vite production build emits a non-blocking warning because its main bundle is about 546 kB minified. Code splitting is deferred until a measured frontend performance need exists.
4. A real Mininet recovery and cloud-provider outage drill requires Linux networking capabilities, a running controller process, PostgreSQL, and optional provider credentials. Deterministic restart/idempotency and provider-fallback tests cover the same safety branches locally.

## Verification recorded

- Dependency resolution: `python -m pip install --dry-run --ignore-installed ".[dev]"`
- Dependency consistency: `python -m pip check`
- Backend tests: `python -m pytest`
- Backend lint: `python -m ruff check .`
- Frontend production build: `npm run build`
- Frontend fixture smoke test: `npm run test:e2e`
