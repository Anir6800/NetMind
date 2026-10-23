# Fresh local start record

Date: 2026-10-23

This is the reproducible clean-start procedure for the local isolated lab. It is deliberately written as commands that match `scripts/dev-netmind.sh`; do not mark the run complete until `scripts/check-netmind.sh` passes on the target machine.

## Clean workspace and dependencies

```bash
git status --short
docker compose down -v
python -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.lock
python -m pip install -r simulation-controller/requirements.txt
npm ci --prefix frontend
```

`docker compose down -v` removes only this Compose project’s PostgreSQL volume, including local incidents and audit evidence. Do not run it when that evidence must be retained.

## Isolated lab startup

Ensure `docker`, `python`, `npm`, and `firebase` are available in the same Bash environment. Choose a non-empty local token without displaying it:

```bash
read -rsp "Controller token: " NETMIND_CONTROLLER_TOKEN; export NETMIND_CONTROLLER_TOKEN; echo
bash scripts/dev-netmind.sh
```

The launcher starts PostgreSQL and waits for `pg_isready`, then starts four child processes: FastAPI on `127.0.0.1:8000`, Vite on `127.0.0.1:5173`, Firebase Auth emulator on `127.0.0.1:9099`, and the token-authenticated controller on `127.0.0.1:8765`. Vite proxies API fetches to FastAPI while preserving browser navigation to SPA routes such as `/incidents`. `Ctrl-C` stops only those children; PostgreSQL remains managed by Compose.

In a second terminal, using the same activated environment, run:

```bash
bash scripts/check-netmind.sh
```

Expected output includes `ok` lines for PostgreSQL, API, frontend, Firebase Auth emulator, and simulation controller. The NVIDIA diagnosis check is intentionally skipped unless `NVIDIA_API_KEY` is exported.

## Evidence to record on the target host

1. Save the health-check output as `docs/evidence/01-fresh-start-health.txt` locally (do not commit secrets).
2. Run the deterministic fixture smoke flow with `npm --prefix frontend run test:e2e` and save its passing output.
3. Follow [demo-script.md](../demo-script.md) with a prepared injected incident; retain raw incident/audit responses and source labels according to [README.md](README.md).

This repository workspace was not reset with `down -v` during documentation preparation, so no false fresh-start result is recorded here.
