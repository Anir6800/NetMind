# NetMind local-only operations handbook

Use this guide from a fresh clone to run the local demo. NetMind is a local lab: all application services bind to `127.0.0.1`; do not publish or reverse-proxy any of these ports.

## What a second group member needs

- Docker Desktop running (with its Linux engine available).
- A Bash-capable shell: Git Bash on Windows, or a Linux/WSL shell with Docker access.
- Python, Node/npm, and the Firebase CLI (`npm install -g firebase-tools`).
- An available loopback port for each service below.

Install project dependencies once from the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.lock
python -m pip install -r simulation-controller/requirements.txt
npm ci --prefix frontend
```

## Local ports

| Service | Loopback address | Purpose |
| --- | --- | --- |
| Frontend (Vite) | `127.0.0.1:5173` | Open this address for the demo. |
| API (FastAPI) | `127.0.0.1:8000` | API and health endpoint. |
| PostgreSQL | `127.0.0.1:5432` | Local Compose database only. |
| Auth emulator | `127.0.0.1:9099` | Firebase Auth emulator used in development. |
| Simulation controller | `127.0.0.1:8765` | Token-authenticated JSON-RPC controller; never browser-facing. |

If a port is occupied, stop the process using it; do not change a service to `0.0.0.0` to work around the conflict.

## Start and prove the demo

From the repository root, activate the virtual environment and set a non-empty controller token without putting it in shell history or a command line:

```bash
read -rsp "Controller token: " NETMIND_CONTROLLER_TOKEN; export NETMIND_CONTROLLER_TOKEN; echo
bash scripts/dev-netmind.sh
```

Keep that terminal open. In a second terminal with the same environment, wait for the services to settle, then run:

```bash
bash scripts/check-netmind.sh
```

The audit must report PostgreSQL, API, frontend, Firebase Auth emulator, and simulation controller as `ok`. Then open `http://127.0.0.1:5173` and follow the [demo script](../demo-script.md). The Simulation Lab selection is an explicit simulation label; it does not send a browser-side controller command.

## Controller safety and privileged Mininet use

The controller accepts only token-authenticated, size-limited, allowlisted typed recovery operations. It does not accept shell commands. Keep its token out of screenshots, terminal recordings, command-line arguments, commits, and logs.

For a simulated demo, no elevated network privileges are required. A Mininet run may need Linux network privileges: run the controller under a dedicated local account. If it must start as root on POSIX, set `NETMIND_CONTROLLER_UID` and, where different, `NETMIND_CONTROLLER_GID` so it drops inherited groups and privileges after network setup. The web API and browser must never receive those privileges. See [controller isolation](../security-controller.md).

## Gemini and other diagnosis-provider keys

The backend reads `GEMINI_API_KEY` (and the optional `NVIDIA_API_KEY`) from the ignored root `.env`; `.env` and `.env.*` are excluded by Git. Create or update that local file only on your machine, for example:

```text
GEMINI_API_KEY=replace-with-your-local-key
```

Never paste a real key into documentation, chat, issues, screenshots, commits, or shell history. A missing, invalid, rate-limited, or unreachable provider switches diagnosis to deterministic read-only/offline mode; it must not unlock recovery. `scripts/check-netmind.sh` makes the optional NVIDIA provider check only when `NVIDIA_API_KEY` is exported in the checking shell.

## Stop and clean up

Press `Ctrl-C` in the terminal running `scripts/dev-netmind.sh`. It stops the API, frontend, Auth emulator, and controller children it launched; PostgreSQL continues in Compose. To stop PostgreSQL while keeping its data, run:

```bash
docker compose stop postgres
```

Only when deliberately discarding local incidents and audit evidence, run:

```bash
docker compose down -v
```

This removes the local PostgreSQL volume. Confirm the current directory is the NetMind repository before running it.

## Verification record — 2026-10-23

- Frontend fixture smoke flow: `npm run test:e2e` from `frontend/` — 2 passed.
- Frontend build: `npm run build` from `frontend/` — passed.
- Backend suite: `python -m pytest tests -q` from `backend/` — 125 passed.
- Live `scripts/check-netmind.sh` requires a running Docker Desktop Linux engine; do not claim a live controller run when that prerequisite is unavailable.
