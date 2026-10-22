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
