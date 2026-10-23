#!/usr/bin/env bash
set -euo pipefail

check_http() {
  local name=$1 url=$2
  curl --fail --silent --show-error --max-time 3 "$url" >/dev/null
  echo "ok: $name"
}

check_tcp() {
  local name=$1 host=$2 port=$3
  python3 - "$host" "$port" <<'PY'
import socket
import sys

with socket.create_connection((sys.argv[1], int(sys.argv[2])), timeout=3):
    pass
PY
  echo "ok: $name"
}

docker compose exec -T postgres pg_isready -U netmind_admin -d netmind >/dev/null
echo "ok: PostgreSQL"
check_http "API" "http://127.0.0.1:8000/health"
check_http "frontend" "http://127.0.0.1:5173/"
curl --silent --show-error --max-time 3 http://127.0.0.1:9099/ >/dev/null
echo "ok: Firebase Auth emulator"
check_tcp "simulation controller" "127.0.0.1" "8765"
if [[ -n "${NVIDIA_API_KEY:-}" ]]; then
  curl --fail --silent --show-error --max-time 5 -H "Authorization: Bearer $NVIDIA_API_KEY" https://integrate.api.nvidia.com/v1/models >/dev/null
  echo "ok: optional NVIDIA diagnosis API"
else
  echo "skip: optional NVIDIA diagnosis API (NVIDIA_API_KEY is not exported)"
fi
if find . -maxdepth 2 \( -name 'vercel.json' -o -name 'firebase.json' -o -name 'app.yaml' \) -print | grep -v '^./firebase.json$' | grep -q .; then
  echo "unexpected hosting configuration" >&2
  exit 1
fi
echo "NetMind local health checks passed"
