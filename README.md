# Patheya Express — Frontend

Nx/pnpm monorepo containing four Angular 21 SPAs for the Patheya Express
food delivery platform:

| App | Dev port | Purpose |
|---|---|---|
| `customer-app` | 4200 | Customer-facing ordering app |
| `restaurant-app` | 4201 | Restaurant partner dashboard |
| `admin-app` | 4202 | Internal admin panel |
| `delivery-app` | 4203 | Delivery partner app |

Shared code lives under `libs/shared/*` (core, auth, ui, api-sdk, models,
map-picker) and `libs/features/*` (one library per feature area, grouped
by app).

The backend (NestJS API gateway, Prisma, PostgreSQL, Redis, Kafka) lives
in the sibling repository `patheya-express-platform` and is not part of
this repo.

## Quick start

```bash
pnpm install
pnpm exec nx serve customer-app   # or restaurant-app / admin-app / delivery-app
```

See [`infrastructure/docs/local-development-guide.md`](infrastructure/docs/local-development-guide.md)
for running the backend alongside it, and the containerized dev loop.

## Building

```bash
pnpm exec nx build customer-app --configuration=production
```

## Infrastructure

Docker images, Kubernetes manifests, CI, and environment/secrets strategy
all live under [`infrastructure/`](infrastructure/docs/README.md) — start
there for anything deployment-related.

## Linting & testing

```bash
pnpm exec nx affected --target=lint
pnpm exec nx affected --target=test
```
