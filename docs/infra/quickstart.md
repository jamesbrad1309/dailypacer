# Quick Start Script

Goal: a new machine goes from `git clone` to a running app with one command.

## `scripts/quickstart.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

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
```

Make it executable and add a root script alias:

```json
// package.json
{
  "scripts": {
    "quickstart": "bash scripts/quickstart.sh"
  }
}
```

```bash
pnpm quickstart
```

## First sign-in

The API makes an owner on every start if it doesn't exist: sign in as
`admin@dailypacer.local` with `dailypaceradmin123` (in the app or the admin
dashboard). It takes over any data from before accounts existed. Change it
with `OWNER_EMAIL`, `OWNER_PASSWORD` and `OWNER_NAME` in `.env`. Anyone else
signs up and is walked through a short set-up with their own empty data.
See [auth.md](../backend/auth.md).

## `.env.example`

```
DATABASE_URL=postgres://dailypacer:dailypacer@localhost:5433/dailypacer
API_PORT=3000
WEB_PORT=5173
```

Commit `.env.example`, gitignore `.env`.

## Full-Docker alternative

For "just run it, no local Node/pnpm setup at all":

```bash
docker compose up --build
```

This builds and runs `web`, `api`, and `postgres` entirely in containers
(see [docker.md](docker.md)) — slower to iterate on (no hot reload without
extra volume-mount config) but zero local toolchain required. Use
`pnpm quickstart` for day-to-day development and `docker compose up --build`
to sanity-check the production-shaped build.
