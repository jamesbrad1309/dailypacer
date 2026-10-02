#!/usr/bin/env bash
# Backend in Docker, frontend with Vite's dev server:
#
#   postgres :5433 ─ api ─ bff 127.0.0.1:4000   (docker compose, rebuilt from your code)
#   frontend http://localhost:5173              (pnpm dev:web, live reload; proxies /graphql to :4000)
#
#   ./start.sh        start everything; Ctrl+C stops the frontend, the backend keeps running
#   ./start.sh stop   stop the backend containers
#
# For the whole app in Docker instead (gateway on :8080): docker compose up --build
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

BACKEND=(postgres api bff)

command -v docker >/dev/null || { echo "Docker is required"; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker isn't running: start Docker Desktop / OrbStack first"; exit 1; }

if [ "${1:-}" = "stop" ]; then
  docker compose stop "${BACKEND[@]}"
  exit 0
fi

command -v pnpm >/dev/null || { echo "pnpm is required: https://pnpm.io/installation"; exit 1; }
[ -f .env ] || cp .env.example .env
[ -d node_modules ] || pnpm install --frozen-lockfile

# Vite is pinned to 5173 (strictPort), so fail fast and say what's holding it.
if command -v lsof >/dev/null && pid=$(lsof -t -iTCP:5173 -sTCP:LISTEN 2>/dev/null | head -1) && [ -n "$pid" ]; then
  echo "Port 5173 is already in use by PID $pid: $(ps -o command= -p "$pid")"
  echo "Is the frontend already running in another terminal? Stop it (or: kill $pid) and try again."
  exit 1
fi

echo "-> starting the backend in Docker (${BACKEND[*]}); the api applies migrations on start"
# --build picks up code changes; --wait returns once the healthchecks pass.
docker compose up -d --build --wait "${BACKEND[@]}"

echo "-> backend ready. Frontend: http://localhost:5173 (Ctrl+C to stop it; './start.sh stop' for the backend)"
exec pnpm dev:web
