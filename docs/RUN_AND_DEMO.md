# Run NetMind on Windows

NetMind is a local-only networking MVP. It visualises topology and incidents, explains stored evidence, and keeps recovery behind a human approval boundary. On Windows it runs in clearly labelled **SIMULATED** lab mode; it does not control a real network.

## Prerequisites

Install and reopen PowerShell after each install:

| Tool | Download | Verify |
| --- | --- | --- |
| Python 3.10+ | [python.org](https://www.python.org/downloads/windows/) | `python --version` |
| Node LTS (20+) | [nodejs.org](https://nodejs.org/) | `node --version`; `npm --version` |
| Git | [git-scm.com](https://git-scm.com/download/win) | `git --version` |
| Docker Desktop | [docker.com](https://www.docker.com/products/docker-desktop/) | Start it, then `docker version` |

The first run needs internet to install Python/npm dependencies and Firebase tools. Docker Desktop must show **Engine running**.

## Run it

Double-click **`run.bat`** in File Explorer, or from PowerShell run:

```powershell
.\run.ps1
```

PowerShell does not run `.ps1` files on double-click by default, so `run.bat` is the double-click wrapper. It invokes PowerShell with `-NoProfile -ExecutionPolicy Bypass` only for this repository script.

On first run, the launcher creates `.venv`, installs locked Python/frontend dependencies, creates ignored `.env` from `.env.example` if needed, and asks once for an optional Gemini key without echoing it. Press Enter to use the labelled offline fallback. First run can take several minutes; later starts normally take under a minute because they use existing dependencies.

When ready, the launcher prints a healthy service table, opens the browser, and writes service output to `logs/`. It never binds a service to `0.0.0.0`.

| Service | URL / port |
| --- | --- |
| Frontend | http://127.0.0.1:5173 |
| API health | http://127.0.0.1:8000/health |
| Firebase Auth emulator | `127.0.0.1:9099` |
| Firebase emulator UI | http://127.0.0.1:4000 |
| PostgreSQL | `127.0.0.1:5432` |
| Controller | `127.0.0.1:8765` (token-only, not browser-facing) |

The launcher seeds these local emulator accounts with password `NetMindDemo!2026`: `viewer@netmind.local`, `operator@netmind.local`, `approver@netmind.local`, and `admin@netmind.local`. Current v0.1.0 has no login screen wired into the routes, so these accounts are available for API/auth verification rather than a browser sign-in flow.

Useful switches: `./run.ps1 -Check` performs only prerequisites/port checks; `-NoBrowser` does not open a tab; `-Reset` asks for `RESET`, deletes the local Compose volume, then starts fresh; `-Stop` is equivalent to `./stop.ps1`. `-Lab` fails clearly because this repository has no configured WSL/VM Mininet adapter.

## Stop and reset

```powershell
.\stop.ps1
.\run.ps1 -Reset
```

`stop.ps1` stops only the process IDs recorded by `run.ps1`, verifies their creation time before terminating their process trees, then stops this Compose project's PostgreSQL container while preserving data. Reset is destructive: it removes local PostgreSQL incidents and audit evidence.

## Troubleshooting

| Problem | Exact fix |
| --- | --- |
| Port in use | Run `Get-NetTCPConnection -State Listen | Where-Object LocalPort -in 5432,8000,5173,9099,4000,8765`; close the listed process, or run `.\stop.ps1` for a prior NetMind run. |
| Docker not running | Start Docker Desktop, wait for **Engine running**, then run `docker version` and `.\run.ps1`. |
| Execution policy blocked | Use `powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1`, or double-click `run.bat`. |
| PostgreSQL is not healthy | Run `docker compose logs postgres`, then `docker compose down` and `.\run.ps1`. Use `down -v` only if reset is intended. |
| Gemini key missing/quota error | Leave it blank for offline mode, or update ignored `.env` then restart: `.\stop.ps1; .\run.ps1`. Never paste a key into a log or commit. |
| Emulator not reachable | Check `Get-NetTCPConnection -LocalPort 9099`; read `logs\firebase.err.log`; then `.\stop.ps1; .\run.ps1`. |
| Blank page | Check http://127.0.0.1:8000/health, read `logs\frontend.err.log`, then run `.\stop.ps1; .\run.ps1 -NoBrowser`. |

## Architecture

```text
React (127.0.0.1:5173) -> FastAPI (127.0.0.1:8000)
    -> telemetry / incidents / policy / audit -> PostgreSQL (127.0.0.1:5432)
    -> controller (127.0.0.1:8765) OR Windows SIMULATED fallback
    -> Gemini or NVIDIA diagnosis adapter (optional cloud only)
```

Everything except an optional diagnosis-provider request is local. Missing or failed provider access produces a read-only offline answer; it never enables automatic recovery.
