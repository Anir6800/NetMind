# Run NetMind locally

The local stack binds to loopback only:

| Service | Address | Start command |
| --- | --- | --- |
| FastAPI | `127.0.0.1:8000` | started by `scripts/dev-netmind.sh` |
| Vite frontend | `127.0.0.1:5173` | started by `scripts/dev-netmind.sh` |
| PostgreSQL | `127.0.0.1:5432` | started by `scripts/dev-netmind.sh` |
| Firebase Auth emulator | `127.0.0.1:9099` | started by `scripts/dev-netmind.sh` |
| Simulation controller | `127.0.0.1:8765` | started by `scripts/dev-netmind.sh` |

Install backend development dependencies with `python -m pip install -r backend/requirements.lock`, install controller dependencies with `python -m pip install -r simulation-controller/requirements.txt`, export `NETMIND_CONTROLLER_TOKEN`, then run:

```bash
bash scripts/dev-netmind.sh
bash scripts/check-netmind.sh
```

The simulation controller remains a separate token-authenticated process and network boundary even though the launcher supervises it as a child. See [troubleshooting.md](troubleshooting.md) and the reproducible [fresh-start record](../evidence/fresh-start.md) for restart, cleanup, and clean-workspace procedures.

No cloud hosting resource is configured. `firebase.json` configures only the local Auth emulator; it is not a hosting deployment configuration.
