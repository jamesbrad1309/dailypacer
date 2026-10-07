#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

command -v pnpm >/dev/null || { echo "pnpm is required: https://pnpm.io/installation"; exit 1; }
command -v docker >/dev/null || { echo "Docker is required"; exit 1; }

[ -f .env ] || cp .env.example .env

echo "-> installing dependencies"
pnpm install --frozen-lockfile

echo "-> starting postgres"
docker compose up -d postgres

echo "-> waiting for postgres to accept connections"
until docker compose exec -T postgres pg_isready -U dailypacer >/dev/null 2>&1; do
  sleep 1
done

echo "-> running database migrations"
pnpm --filter api exec dotenv run -f ../../.env -- prisma migrate deploy

echo "-> starting web + api in dev mode"
pnpm dev
