# Environment Guide

## Two different things named "environment"

1. **Angular's own build-time environments** —
   `apps/*/src/environments/environment.{ts,staging.ts,prod.ts}`, selected
   by Angular's `fileReplacements` in each app's `project.json`
   (`development` / `staging` / `production` configurations already
   existed before this phase and are untouched by it). These bake
   `apiBaseUrl`, `socketUrl`, `mediaBaseUrl`, and public client keys
   directly into the JS bundle.
2. **Infrastructure-level environment variables** —
   `infrastructure/environments/.env.{development,staging,production}`,
   introduced in this phase. These drive *Docker/Compose/CI*, not the
   Angular app itself: which of the above build configurations to bake in
   (`BUILD_CONFIGURATION`), which host ports to publish, which base image
   versions to pin, and where to push/tag images.

These two layers never overlap in content. `BUILD_CONFIGURATION=staging`
in an infra `.env` file is what causes Angular's *own* `staging`
`fileReplacement` to run — the infra layer selects which of the app's
existing environments gets built, it doesn't duplicate their values.

## Files

| File | `BUILD_CONFIGURATION` | Used by |
|---|---|---|
| `.env.example` | — (template) | Copy this to get started |
| `.env.development` | `development` | `docker-compose.dev.yml`, `infra-up.sh development` |
| `.env.staging` | `staging` | `docker-compose.yml`, `infra-up.sh staging` |
| `.env.production` | `production` | `docker-compose.prod.yml`, `infra-up.sh production` |

All four are committed — none contain secrets (see
[secrets-guide.md](secrets-guide.md)).

## Validation

`infrastructure/scripts/validate-env.sh <file>` checks, before any compose
or CI command reads the file:

- Every required variable is present and non-empty
- `BUILD_CONFIGURATION` is one of `development`/`staging`/`production`
  (never an invented value — it must match a real Angular build
  configuration in `apps/*/project.json`)
- Every `*_PORT` variable is a valid port number (1–65535)
- All four app ports are distinct

Every script in `infrastructure/scripts/` that reads an env file
(`dev.sh`, `prod-up.sh`, `docker-build.sh`, `infra-up.sh`) runs this
validation first and fails fast rather than passing a bad value through to
`docker compose`. Tested directly, including both failure modes (missing
file, invalid `BUILD_CONFIGURATION`):

```
✓ infrastructure/environments/.env.production is valid
✗ infrastructure/environments/.env.doesnotexist does not exist
✗ BUILD_CONFIGURATION='bogus' must be one of: development, staging, production
```

## Type-safe configuration on the Angular side

Already handled by the existing architecture and untouched here: every app
provides `APP_ENVIRONMENT` (an `InjectionToken<AppEnvironment>`, see
[`app-environment.ts`](../../libs/shared/core/src/lib/environment/app-environment.ts))
in `app.config.ts`, so the whole app gets a compile-time-checked,
dependency-injected config object rather than reading `process.env` or an
untyped global at runtime. This phase intentionally doesn't introduce a
second, parallel runtime-config mechanism — see
[infrastructure-overview.md](infrastructure-overview.md) for why.
