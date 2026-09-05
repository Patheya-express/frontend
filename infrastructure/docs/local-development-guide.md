# Local Development Guide

For full-stack setup (this repo plus the backend), use the canonical path in
[`tools/dev/DEVELOPMENT.md`](../../tools/dev/DEVELOPMENT.md) (`pnpm run setup` / `pnpm run dev`)
instead of assembling the steps below by hand. This document is the supporting reference that
tooling drives and links to — not an alternative starting point.

## Fastest loop: run Angular directly on the host

For day-to-day frontend work, skip Docker entirely:

```bash
pnpm install
pnpm exec nx serve customer-app     # or restaurant-app / admin-app / delivery-app
```

This is faster than any containerized option (no image rebuild when a
dependency changes) and is what `apps/*/src/environments/environment.ts`
already assumes — it points `apiBaseUrl`/`socketUrl` at
`http://localhost:3000`, matching the backend's default dev port.

## Running the backend alongside it

The backend lives in the sibling repo `patheya-express-platform` and is
started independently — this repo's `docker-compose.yml` deliberately
defines no backend service (see
[infrastructure-overview.md](infrastructure-overview.md) for why: these
are static SPAs, and API calls happen browser-to-backend, not
container-to-container). From `patheya-express-platform`:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d   # postgres, redis, kafka, zookeeper, AND api-gateway
```

That single command is the normal path — the sibling repo's own
`docker-compose.yml` builds and runs `api-gateway` itself (published on
`:3000`) alongside its dependencies; there is no separate `pnpm --filter
api-gateway start:dev` step to run on top of it, and running one anyway
races the containerized api-gateway for the same port (`EADDRINUSE`).
`node tools/launcher/cli.mjs <app> web`'s own backend auto-start
(`tools/launcher/lib/detect-backend.mjs`) does exactly this one command.

Prefer running api-gateway on the host instead of in a container (faster
inner loop)? Exclude it from Compose explicitly and run it yourself —
see that repo's own README for its `start:dev` script:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis kafka zookeeper
pnpm --filter api-gateway start:dev   # from patheya-express-platform
```

Pass `--no-backend-start` to the launcher in that case, so it doesn't
also try to bring up the containerized api-gateway underneath your host
process.

Its `.env.example` already lists `CUSTOMER_APP_URL=http://localhost:4200`
etc. in its CORS allowlist, matching the ports this repo's
`infrastructure/environments/.env.development` publishes.

## Containerized dev loop

For verifying the containerized path itself (or on a machine without Node
installed), `infrastructure/scripts/dev.sh` starts all four apps via
`docker-compose.dev.yml` — the `dev` build stage runs `nx serve` inside
the container with `apps/` and `libs/` bind-mounted from the host, so
edits are picked up without an image rebuild:

```bash
infrastructure/scripts/dev.sh
# customer-app:   http://localhost:4200
# restaurant-app: http://localhost:4201
# admin-app:      http://localhost:4202
# delivery-app:   http://localhost:4203
```

## Prod-parity smoke testing

To check what actually ships (the built, nginx-served bundle, not the dev
server) before opening a PR:

```bash
infrastructure/scripts/docker-run.sh customer-app 4200 infrastructure/environments/.env.development
```

Builds the production image if it doesn't already exist, runs it, and
polls `/healthz` until it's up.

## Cleaning up

```bash
infrastructure/scripts/docker-cleanup.sh          # stop everything, prune dangling layers/build cache
infrastructure/scripts/image-cleanup.sh all 3     # keep only the 3 most recent local images per app
```

## Platform note

The scripts in `infrastructure/scripts/` are POSIX shell (`.sh`), run via
Git Bash on this Windows machine (already the shell backing this
project's tooling) or natively in CI/Linux. There's no PowerShell
duplicate of each script — Windows contributors without Git Bash can run
Docker commands directly (each script is a thin, readable wrapper around
one `docker`/`docker compose` invocation) or invoke them through WSL.
