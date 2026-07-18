# Infrastructure Overview

## What this repo is

`patheya-express-frontend` is an Nx/pnpm monorepo containing four
independent, client-side-rendered Angular SPAs (`customer-app`,
`restaurant-app`, `admin-app`, `delivery-app`) and their shared
`libs/shared/*` / `libs/features/*` libraries. There is no server-side
code here — the NestJS backend (`api-gateway`) lives in the sibling repo
`patheya-express-platform`, is provisioned and deployed independently, and
is *not* modified by anything in this `infrastructure/` directory.

Because there's no backend here, this infrastructure layer is narrower
than a typical full-stack "Phase 0": there's no database, cache, or queue
to containerize, and — because Angular bakes `apiBaseUrl`/`socketUrl`/keys
into the bundle at build time (see
[`AppEnvironment`](../../libs/shared/core/src/lib/environment/app-environment.ts))
— there are no runtime secrets to manage either. See
[secrets-guide.md](secrets-guide.md) for the full reasoning.

## Directory map

```
infrastructure/
├── docker/            Dockerfile + docker-compose (dev/prod overlays) + nginx config
├── environments/       Infra-level .env files (ports, build configuration, image tags)
├── scripts/            Shell entry points wrapping the above (dev.sh, docker-build.sh, ...)
├── kubernetes/          Kustomize base + development/staging/production overlays
├── terraform/           DNS + ACM certificate provisioning (see terraform/README.md for scope)
├── monitoring/          Prometheus scrape config, alert rules, Grafana dashboard
├── ci/                  CI foundation notes (workflows themselves live in .github/workflows/)
└── docs/                This directory
```

## How a request actually flows

Each app is a **static SPA**, served by nginx. There is no server-side
rendering and no server-side API proxying:

1. The browser loads `index.html` + a content-hashed JS/CSS bundle from
   nginx (`infrastructure/docker/nginx/app.conf.template`).
2. The Angular app, running entirely in the browser, calls the backend API
   directly at whatever `apiBaseUrl` was baked into that build
   (`apps/*/src/environments/environment.*.ts`).
3. nginx never talks to the backend — it only ever serves static files.

This is why `docker-compose.yml` in this repo defines no backend service
and no shared Docker network with `patheya-express-platform`: there's
nothing for the containers to say to each other. See
[docker-guide.md](docker-guide.md) for how the two repos' local dev loops
fit together in practice.

## The four pillars

| Pillar | Where | Status |
|---|---|---|
| Containerization | `docker/` | Built, tested, running — see [docker-guide.md](docker-guide.md) |
| Environment strategy | `environments/` | Built, validated — see [environment-guide.md](environment-guide.md) |
| Kubernetes readiness | `kubernetes/` | Manifests render cleanly for all 3 environments (`kubectl kustomize`); not yet applied to a real cluster |
| CI | `.github/workflows/` + `ci/` | Lint/test/build/docker-build/security-scan wired up; deployment intentionally not wired up yet (see [`ci/README.md`](../ci/README.md)) |

## What's deliberately out of scope for this phase

- **Deploying** anything to a real cluster or cloud account — see
  [`infrastructure/ci/README.md`](../ci/README.md) and
  [`infrastructure/terraform/README.md`](../terraform/README.md) for what's
  built versus what's deferred and why.
- **The backend's** infrastructure (database, Redis, Kafka, its own
  Dockerfile/health checks) — already exists in `patheya-express-platform`
  and isn't duplicated or modified here.
- **Runtime environment injection** for the Angular apps (e.g. an
  `envsubst`-generated `config.js`) — the existing build-time
  `fileReplacements` mechanism in `apps/*/project.json` already solves
  per-environment config without touching `app.config.ts`, so this phase
  builds Docker images around that mechanism (`BUILD_CONFIGURATION` build
  arg) instead of replacing it. See [production-guide.md](production-guide.md).
