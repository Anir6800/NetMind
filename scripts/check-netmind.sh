#!/usr/bin/env bash
set -euo pipefail

curl --fail --silent http://127.0.0.1:8000/health
curl --fail --silent http://127.0.0.1:5173/ >/dev/null
if find . -maxdepth 2 \( -name 'vercel.json' -o -name 'firebase.json' -o -name 'app.yaml' \) -print | grep -v '^./firebase.json$' | grep -q .; then
  echo "unexpected hosting configuration" >&2
  exit 1
fi
echo "NetMind local health checks passed"
