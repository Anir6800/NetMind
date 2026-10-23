#!/usr/bin/env bash
set -euo pipefail

PYTHON=${PYTHON:-python}
: "${NETMIND_CONTROLLER_TOKEN:?Set a non-empty NETMIND_CONTROLLER_TOKEN before starting the local controller}"
PIDS=()

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait "${PIDS[@]}" 2>/dev/null || true
  exit "$status"
}

for command in docker "$PYTHON" npm firebase; do command -v "$command" >/dev/null || { echo "missing required command: $command" >&2; exit 1; }; done
trap cleanup EXIT
trap 'exit 130' INT TERM

docker compose up -d postgres
for _ in {1..20}; do
  if docker compose exec -T postgres pg_isready -U netmind_admin -d netmind >/dev/null 2>&1; then break; fi
  sleep 1
done
docker compose exec -T postgres pg_isready -U netmind_admin -d netmind >/dev/null

(cd backend && exec "$PYTHON" -m uvicorn app.main:app --host 127.0.0.1 --port 8000) & PIDS+=("$!")
(cd frontend && exec npm run dev -- --host 127.0.0.1 --port 5173) & PIDS+=("$!")
(cd simulation-controller && exec "$PYTHON" topology/controller.py) & PIDS+=("$!")
(exec firebase emulators:start --only auth) & PIDS+=("$!")
echo "NetMind: API http://127.0.0.1:8000, frontend http://127.0.0.1:5173, Auth http://127.0.0.1:9099, controller 127.0.0.1:8765"
echo "Run 'bash scripts/check-netmind.sh' after services finish starting. Ctrl-C stops only children started by this script."
wait -n "${PIDS[@]}"
