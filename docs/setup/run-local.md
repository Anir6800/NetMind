# Run NetMind locally

The local stack binds to loopback only:

| Service | Address | Start command |
| --- | --- | --- |
| FastAPI | `127.0.0.1:8000` | started by `scripts/dev-netmind.sh` |
| Vite frontend | `127.0.0.1:5173` | started by `scripts/dev-netmind.sh` |
| PostgreSQL | `127.0.0.1:5432` | `docker compose up -d postgres` |
| Firebase Auth emulator | `127.0.0.1:9099` | `firebase emulators:start --only auth` |

Install backend development dependencies with `python -m pip install -e "backend[dev]"`, then run:

```bash
bash scripts/dev-netmind.sh
bash scripts/check-netmind.sh
```

The simulation controller is intentionally independent of the web service. Start it separately with `NETMIND_CONTROLLER_TOKEN` set, then run `bash scripts/check-netmind.sh`; the startup script does not make the API or frontend its parent or transport dependency. See [troubleshooting.md](troubleshooting.md) for restart and cleanup procedures.

No cloud hosting resource is configured. `firebase.json` configures only the local Auth emulator; it is not a hosting deployment configuration.
