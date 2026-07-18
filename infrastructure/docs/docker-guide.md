# Docker Guide

## Image design

One Dockerfile, [`infrastructure/docker/frontend.Dockerfile`](../docker/frontend.Dockerfile),
builds all four apps — they're structurally identical Nx-built static
bundles sharing the same `libs/` workspace, so a single parameterized
definition (`--build-arg APP_NAME=...`) is used instead of four files that
would inevitably drift. It has three stages:

- **`build`** (`node:24-alpine`) — installs the full pnpm workspace, then
  runs `nx build <app> --configuration=<BUILD_CONFIGURATION>`.
- **`dev`** (`node:24-alpine`) — the same workspace install, but runs
  `nx serve` instead of building; used only by `docker-compose.dev.yml`,
  which bind-mounts `apps/` and `libs/` over it for hot reload.
- **`runtime`** (`nginxinc/nginx-unprivileged:1.27-alpine`) — copies only
  the built `dist/apps/<app>/browser` output. This image runs as uid 101
  out of the box (no manual `chown` of nginx's internals needed), listens
  on 8080 (unprivileged ports only), and is what actually ships.

Build context is always the **repository root**, not `infrastructure/docker/`
— Nx needs the whole workspace (`nx.json`, `tsconfig.base.json`, every
`libs/*` package) to build any single app, since none of them are
published/versioned packages.

```bash
docker build -f infrastructure/docker/frontend.Dockerfile \
  --build-arg APP_NAME=customer-app \
  --build-arg BUILD_CONFIGURATION=production \
  -t patheya-express-customer-app .
```

### What's inside the runtime image

- `infrastructure/docker/nginx/nginx.conf` — process-level config: JSON
  access logs to stdout, gzip, a shared rate-limit zone.
- `infrastructure/docker/nginx/security-headers.conf` — `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `Strict-Transport-Security`, etc. `include`-d into every `location`
  block that also sets its own `add_header` — nginx does **not** merge
  `add_header` lists across nesting levels, so a location with its own
  `add_header` silently drops the server block's headers unless this file
  is included explicitly. (This was caught during validation: headers were
  missing from `/index.html` and every cached asset until the include was
  added everywhere.)
- `infrastructure/docker/nginx/app.conf.template` — the per-app server
  block: SPA fallback (`try_files ... /index.html`), immutable caching for
  content-hashed assets, `/healthz` + `/readyz`, and a loopback-only
  `/stub_status` for the Prometheus exporter sidecar (see
  [`../monitoring/README.md`](../monitoring/README.md)).

## Health checks

- **`/healthz`** — liveness. Always 200 if nginx is serving.
- **`/readyz`** — readiness. 200 only if `index.html` actually exists in
  the image (`try_files /index.html =503`).
- The image's `HEALTHCHECK` polls `/healthz` every 30s; Kubernetes probes
  (`infrastructure/kubernetes/base/*/deployment.yaml`) use both endpoints.

## Compose files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Base: builds and runs all four apps as production images |
| `docker-compose.dev.yml` | Overlay: swaps to the `dev` build stage + bind mounts for hot reload |
| `docker-compose.prod.yml` | Overlay: read-only root filesystem, dropped capabilities, resource limits |

```bash
# Production-shaped smoke test
docker compose -f infrastructure/docker/docker-compose.yml up --build

# Hot-reload dev loop in containers (most of the time, `nx serve <app>` directly on the host is faster)
infrastructure/scripts/dev.sh

# Hardened single-host production deployment
infrastructure/scripts/prod-up.sh
```

All three combinations were built and run end-to-end during this phase:
all four containers reach Docker's `healthy` state, serve `200` on `/`,
`/healthz`, and correctly SPA-fallback on deep routes; security headers
were verified present on both `/` and a hashed asset response; the
non-root user was confirmed via `docker exec ... id` (`uid=101(nginx)`);
`docker compose stop` completed in under 2 seconds (well inside the
default 10s grace period), confirming nginx's graceful shutdown.

## Why there's no backend service in these compose files

Every app here is a static SPA — API calls happen in the *browser*, not
container-to-container. There is nothing for nginx to reach on the
backend, so there's no shared Docker network with
`patheya-express-platform`'s own compose stack to wire up. Run the backend
separately; see [local-development-guide.md](local-development-guide.md).

## Registry and tagging

`infrastructure/scripts/docker-build.sh <app|all> <env-file>` builds and
tags images as `${IMAGE_REGISTRY}/${app}:${IMAGE_TAG}`, reading both from
the given `infrastructure/environments/.env.*` file. CI
(`.github/workflows/docker-build.yml`) pushes to `ghcr.io` on merges to
`main`, tagged with the commit SHA.
