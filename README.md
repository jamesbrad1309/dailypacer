# DailyPacer

A habit tracker for **custom habits**: each one gets its own schedule, unit,
target and start time. You check habits off (or log a value) each day and
track streaks over time. A **journal** records what you did, felt, and what
happened each day, written as a quick `/action` `/feeling` `/event` list.

- **Web:** React 19, TypeScript, Vite, Tailwind, shadcn/ui, Apollo Client (`apps/web`)
- **BFF:** Express + Apollo Server GraphQL, the only backend the browser talks to (`apps/bff`)
- **API:** NestJS REST service with the domain logic, Prisma, PostgreSQL (`apps/api`)
- **Gateway:** nginx in Docker, a single entry point that routes `/graphql` to the BFF and everything else to the web app
- **Tooling:** pnpm workspace, native TypeScript `#` import aliases, Biome + oxlint, Docker

## Quick start

Requirements: Node ≥ 22, pnpm 10, Docker.

```bash
pnpm quickstart
```

This one command:

1. copies `.env.example` to `.env` if `.env` doesn't exist
2. installs dependencies
3. starts Postgres in Docker
4. runs the migrations
5. starts the web app, the BFF and the API in watch mode

When it's running:

| Service       | URL                              |
| ------------- | -------------------------------- |
| Web           | http://localhost:5173            |
| GraphQL (BFF) | http://localhost:4000/graphql    |
| REST API      | http://localhost:3000 (internal; the BFF calls it) |
| Postgres      | `localhost:5433` (dailypacer/dailypacer) |

In development, Vite proxies `/graphql` to the BFF.

### Backend in Docker, frontend with Vite

```bash
./start.sh        # Ctrl+C stops the frontend; the backend keeps running
./start.sh stop   # stop the backend containers
```

Builds and starts Postgres, the API and the BFF in Docker (the API applies
migrations on start), waits until they're healthy, then runs the Vite dev
server at http://localhost:5173 with live reload. The BFF container is
published on `127.0.0.1:4000` for Vite's proxy, so don't run `pnpm dev:bff`
at the same time.

### Run everything in Docker

```bash
docker compose up --build
```

Everything is served through the gateway at http://localhost:8080 (the app
at `/`, GraphQL at `/graphql`). The API and BFF aren't published to the
host. You don't need Node installed, but there's no hot reload. Keep the
`--build`: without it Compose reuses old images and your changes won't show.

## Scripts

Run from the repo root:

| Command         | What it does                         |
| --------------- | ------------------------------------ |
| `pnpm dev`      | Web + admin + BFF + API in watch mode |
| `pnpm dev:web`  | Web only                             |
| `pnpm dev:admin` | Admin dashboard only (`127.0.0.1:5174`, [docs](docs/admin/dashboard.md)) |
| `pnpm dev:bff`  | BFF only                             |
| `pnpm dev:api`  | API only                             |
| `pnpm build`    | Build all apps                       |
| `pnpm lint`     | oxlint + Biome lint                  |
| `pnpm format`   | Biome format (writes changes)        |
| `pnpm check`    | Biome lint + format (writes changes) |

Database scripts, run in the API package:

```bash
pnpm --filter api migrate:dev      # create/apply a migration after editing schema.prisma
pnpm --filter api prisma:studio    # browse the database
```

## Configuration

`.env` lives at the repo root (see `.env.example`):

| Variable       | Default                                             |
| -------------- | --------------------------------------------------- |
| `DATABASE_URL` | `postgres://dailypacer:dailypacer@localhost:5433/dailypacer` |
| `API_PORT`     | `3000`                                              |
| `BFF_PORT`     | `4000`                                              |
| `API_URL`      | `http://localhost:3000` (where the BFF finds the API) |
| `WEB_PORT`     | `5173`                                              |
| `BFF_URL`      | `http://localhost:4000` (where Vite's dev proxy sends `/graphql`; set it in the shell, e.g. `BFF_URL=http://localhost:8080 pnpm dev:web`) |
| `NODE_ENV`     | `development`                                       |
| `LOG_LEVEL`    | `debug` in dev, `info` in prod                      |

## Layout

```
apps/
  api/        NestJS REST API + Prisma (schema in prisma/schema.prisma)
  bff/        GraphQL BFF: Express + Apollo, calls the API over REST
  web/        React + Vite frontend
docker/       Dockerfiles, gateway and web nginx configs
docs/         Architecture and design notes
scripts/      quickstart.sh
```

## Docs

Design notes are in [`docs/`](docs/index.md) and mirrored to the
[wiki](https://github.com/jamesbrad1309/dailypacer/wiki). They cover the
architecture, data model, use cases (with build status), GraphQL/Nest
structure, logging, and the Docker setup.
