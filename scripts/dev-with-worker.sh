#!/bin/bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.local"
  set +a
fi

mkdir -p storage/icc logs

if [ ! -x "worker/.venv/bin/python" ]; then
  echo "→ Creating worker virtualenv"
  python3 -m venv worker/.venv
fi

echo "→ Installing worker dependencies"
worker/.venv/bin/pip install -r worker/requirements.txt

export APP_ROOT="${APP_ROOT:-$APP_DIR}"
export EXHIBITION_API_BASE_URL="${EXHIBITION_API_BASE_URL:-http://127.0.0.1:3007}"

cleanup() {
  if [ -n "${WEB_PID:-}" ]; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
  if [ -n "${WORKER_PID:-}" ]; then
    kill "$WORKER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "→ Starting Next.js on port 3007"
npm run dev &
WEB_PID=$!

echo "→ Starting fulfilment worker"
worker/.venv/bin/python worker/fulfilment_worker.py &
WORKER_PID=$!

wait "$WEB_PID"
