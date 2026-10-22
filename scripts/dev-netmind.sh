#!/usr/bin/env bash
set -euo pipefail

trap 'kill 0' EXIT INT TERM
docker compose up -d postgres
(cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000) &
(cd frontend && npm run dev -- --host 127.0.0.1 --port 5173) &
echo "NetMind: API http://127.0.0.1:8000, frontend http://127.0.0.1:5173"
echo "Simulation controller is started independently when its implementation is added."
wait
