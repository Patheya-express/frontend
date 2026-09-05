# Patheya Express — Developer Setup

The canonical, versioned developer onboarding path for Patheya Express. If another document (this
repo's `README.md`, `tools/launcher/README.md`, or the backend repo's `README.md`/
`docs/infrastructure/*.md`) gives startup instructions, it links back here rather than repeating
its own copy — see "One canonical path" below.

This supersedes the external `Patheya-Express-Developer-Bootstrap-v5` folder. That package worked,
but lived outside any Git repository — a new developer had to be handed a folder out-of-band
instead of getting it from `git clone`, and it duplicated its entire implementation twice (a full
PowerShell tree and a full bash tree), which is a real drift risk: a fix landing in one platform's
script and not the other. Everything it did is reimplemented here as one cross-platform Node.js
script plus documentation, both versioned in this repo. See "Bootstrap v5 migration" at the bottom
for exactly what moved where.

## Repository relationship

Two repositories, cloned as siblings:

```text
<workspace>/
├── frontend/                    ← this repo
└── patheya-express-platform/    ← backend, cloned separately
```

Neither repo hardcodes the other's absolute path — `tools/dev/bootstrap.mjs` and
`tools/launcher/lib/detect-backend.mjs` both resolve the backend as `../patheya-express-platform`
relative to wherever `frontend` itself is checked out, so this works under
`C:\Users\<you>\...`, `/home/<you>/...`, or any other workspace root.

## Ownership model

| Owns | Lives in | Responsible for |
|---|---|---|
| Docker Compose / local infrastructure | `patheya-express-platform` (`infrastructure/docker/docker-compose.yml`) | PostgreSQL, Redis, Kafka, Zookeeper, and the **api-gateway container itself** — the compose file builds and runs it, published on `:3000`. See that repo's `docs/infrastructure/docker.md`. |
| Backend dependencies, Prisma, migrations | `patheya-express-platform` | Its own `pnpm install`, `prisma migrate`, `.env` — this repo's tooling only ever *invokes* those, never re-implements them. |
| Full-stack onboarding orchestration | `frontend/tools/dev/` (this directory) | Coordinating the two repos for a new developer: tool checks, dependency install, starting Docker Compose, waiting for backend health, then handing off to the frontend launcher. Owns *sequencing*, not backend internals. |
| Frontend environment validation, backend **health detection**, app/platform startup | `frontend/tools/launcher/` | Everything from "is the backend already healthy" onward — see its own `README.md`. `tools/dev/bootstrap.mjs` calls straight into this rather than re-checking health itself. |
| Angular apps, Capacitor, frontend tests | `frontend/apps/*`, `frontend/libs/*` | Unrelated to developer tooling — untouched by any of this. |

`tools/dev/bootstrap.mjs` is deliberately thin: it never re-implements health parsing, tool
checks, or app selection — it imports and calls the launcher's own modules
(`detectBackend`, `buildToolChecks`, `log`, `exec`) for all of that. There is exactly one
implementation of "what does a healthy backend response look like" in this whole system:
`tools/launcher/lib/detect-backend.mjs`.

## Docker architecture

```text
Docker Desktop
    │
    ▼
Docker Compose (patheya-express-platform/infrastructure/docker/docker-compose.yml)
    │
    ├── PostgreSQL  :5432
    ├── Redis       :6379
    ├── Kafka       :9092   (present only because an env var requires it — unused by app code)
    ├── Zookeeper
    └── API Gateway :3000   ← the only backend process. Built from the backend repo's root
                               Dockerfile, published on 3000 by Compose itself.
```

**There is exactly one process on port 3000, ever: the Compose-managed `api-gateway` container.**
Nothing in this repo's tooling — not `tools/launcher`, not `tools/dev/bootstrap.mjs` — starts a
second one. `tools/launcher/lib/detect-backend.mjs`'s own local auto-start runs `docker compose up
-d` and stops there; it deliberately does **not** also run `pnpm --filter api-gateway start:dev`,
because that raced the container for the same port in an earlier version of this tooling and
produced `EADDRINUSE :::3000`. If you intentionally want api-gateway running natively on the host
instead of in a container (faster inner-loop iteration on backend code), exclude it from Compose
yourself and pass `--skip-infrastructure` — see "Backend-only" below.

### Ports

| Service | Port | Owned by |
|---|---|---|
| API Gateway | `3000` | Docker Compose (`patheya-express-platform`) |
| Customer App | `4200` | `nx serve customer-app` (this repo) |
| Partner/Restaurant App | `4201` | `nx serve restaurant-app` |
| Admin App | `4202` | `nx serve admin-app` |
| Delivery App | `4203` | `nx serve delivery-app` |
| PostgreSQL | `5432` | Docker Compose |
| Redis | `6379` | Docker Compose |
| Kafka | `9092` | Docker Compose (unused by application code) |

(Verified against `patheya-express-platform/infrastructure/docker/docker-compose.yml` and this
repo's `tools/launcher/lib/registry.mjs`'s `defaultPort` per app.)

## One canonical path

### First-time setup

```bash
git clone <frontend-repository-url> frontend
git clone <backend-repository-url> patheya-express-platform   # as a sibling of frontend/
cd frontend
pnpm run setup
```

`pnpm run setup` (→ `node tools/dev/bootstrap.mjs customer --setup`):

1. Installs frontend dependencies (`pnpm install` in this repo) and backend dependencies (`pnpm
   install` in the sibling repo) — each repo's own package manager, never forced to match. This
   runs **first, using only Node's built-in `child_process`**, deliberately before loading anything
   that itself needs a dependency (`cross-spawn`, pulled in by the launcher's own `exec.mjs`) — on a
   genuinely fresh clone, node_modules doesn't exist yet, so the very script responsible for
   installing dependencies can't itself depend on one. Reports the installed pnpm version alongside
   each repo's pinned version (see "pnpm version policy" below).
2. Validates Git/Node/pnpm/Nx/Docker are present (web-scope tools only — see "Mobile" below) — now
   safe to check, since dependencies were just confirmed installed in step 1.
3. Scaffolds `patheya-express-platform/apps/api-gateway/.env` from its own `.env.example` if one
   doesn't already exist (never overwrites a real one). Its defaults already match Compose's
   Postgres/Redis/Kafka ports, so this alone is enough for local development — fill in
   Razorpay/SMTP/Cloudinary values yourself only if you need those specific flows.
4. Starts Docker Desktop if it isn't running yet, then `docker compose up -d` (Postgres, Redis,
   Kafka, Zookeeper, api-gateway).
5. Waits for `GET /api/v1/health` to report `{success: true, data: {status: "ok", ...}}` — via the
   frontend launcher's own `detectBackend()`, not a second implementation.
6. Runs backend database migrations (`pnpm --filter api-gateway run db:migrate`, i.e. `prisma
   migrate dev` — never `migrate reset` or `db push`) — first-time only, never on daily startup (an
   unmigrated database still reports "healthy," since the health check is a raw connectivity probe,
   not a schema check). Runs with your terminal attached, so if Prisma ever needs to ask a
   confirmation question, you see and answer it yourself — see "Prisma asks a question" below.
7. Starts the Customer App via the frontend launcher.

Only failures print guidance and stop the flow — nothing fails silently. Verified against an actual
zero-`node_modules` fresh clone in a scratch directory (not just this repeated on an
already-set-up machine) — see this change's validation record.

### Daily startup

```bash
pnpm run dev
```

(→ `node tools/dev/bootstrap.mjs customer`, i.e. the same steps minus dependency install, `.env`
scaffolding, and migrations — those are one-time, not daily.) Every step it does run is idempotent:
`docker compose up -d` on an already-running stack is a fast no-op check, and the health poll
returns immediately once the backend is already up.

Want a different app?

```bash
node tools/dev/bootstrap.mjs partner
node tools/dev/bootstrap.mjs delivery
node tools/dev/bootstrap.mjs admin
```

### Frontend-only

Backend/infrastructure already running (from a teammate's machine you're not touching, a previous
`pnpm run dev` you left up, or a remote environment)? Skip straight to the launcher — it still does
its own backend health check, it just never tries to start anything unless that check fails:

```bash
pnpm customer:web
pnpm partner:web
pnpm delivery:web
pnpm admin:web
```

See `tools/launcher/README.md` for every option (`--env=qa`, `--device=`, `--profile=`, etc.).

### Backend-only

```bash
pnpm run dev:backend-only
```

(→ `node tools/dev/bootstrap.mjs none --backend-only`) Starts/verifies Docker Compose and waits for
backend health; never launches a frontend app. Useful when working purely on backend code, or when
starting infrastructure for a teammate/CI step ahead of time.

Iterating on api-gateway's own code natively instead of rebuilding the container each time? Exclude
it from Compose and run it on the host — see `patheya-express-platform/docs/infrastructure/
docker.md` — then run the frontend launcher with `--skip-infrastructure` so this repo's tooling
doesn't also try to bring up a containerized api-gateway underneath it:

```bash
node tools/dev/bootstrap.mjs customer --skip-infrastructure
```

### Mobile (Android / iOS)

`tools/dev/bootstrap.mjs` intentionally only validates **web**-scope tools (Node/pnpm/Docker) —
Android Studio/ADB/Xcode aren't required to get the backend and a web dev server running, so
`pnpm run setup` doesn't gate on them. Once the backend is up (`pnpm run dev:backend-only`, or any
`pnpm run dev`/`pnpm <app>:web` that already started it), the frontend launcher handles mobile
platforms and their own tool validation directly:

```bash
pnpm customer:android
pnpm customer:ios      # macOS only — Xcode doesn't run on Windows/Linux
pnpm partner:android
pnpm delivery:android
```

`pnpm doctor` reports Java/Gradle/Android SDK/Xcode/CocoaPods status across every app at once.

## Environment configuration

- **Frontend**: `apps/<app>/src/environments/environment*.ts` — not templated/scaffolded by this
  tooling (no secrets live there beyond already-checked-in dev defaults like the Razorpay test key)
  and unaffected by `tools/dev/`.
- **Backend**: `patheya-express-platform/apps/api-gateway/.env`, scaffolded from `.env.example` by
  `pnpm run setup` (step 3 above) if missing. Never committed (already gitignored in that repo);
  never printed by any script here. Its checked-in `.env.example` defaults already match
  `docker-compose.yml`'s Postgres/Redis/Kafka defaults, so a bare copy is sufficient to migrate and
  develop locally — real values (Razorpay, SMTP, Cloudinary) are only needed for those specific
  flows and are never invented by this tooling.

## pnpm version policy

Frontend pins `pnpm@11.5.3` (`package.json`'s `packageManager` field); the backend pins `11.4.0`
(`devEngines.packageManager`). This is **intentional, not an oversight**: each repo runs its own
`pnpm install` in its own directory (see "Ownership model" above) — this tooling never forces one
repo's pin onto the other, and doesn't use Corepack to enforce a single canonical version either.
Corepack was deliberately ruled out here because enabling it can fail with an `EPERM` error on
Windows when Node is installed under `C:\Program Files\nodejs` and the shell isn't elevated — a real
issue hit while building this tooling (see "Bootstrap v5 migration" below) — and requiring
Administrator PowerShell just to run `pnpm run setup` would be a worse trade than tolerating two
close pnpm versions.

`pnpm run setup` reports all three numbers so a real mismatch is visible instead of silently
surfacing later as a confusing install/lockfile error:

```text
pnpm version check
  Installed: 11.5.3
  Frontend pins: 11.5.3 (frontend/package.json)
  Backend pins: 11.4.0 (patheya-express-platform/package.json)
```

If your installed pnpm can run `pnpm install` successfully in both repos (as 11.5.3 does against
both pins above), the version difference is not something to fix — it's the accepted trade-off
described here. This is a warning, never a blocking error.

## Required vs. optional tooling

| | Required for web dev | Required only for mobile | Optional |
|---|---|---|---|
| Git, Node.js, pnpm, Docker | ✔ | | |
| Java, Android SDK/`adb`, Gradle | | ✔ (Android) | |
| Xcode, CocoaPods | | ✔ (iOS, macOS only) | |
| GitHub CLI (`gh`) | | | ✔ — never required by any script here |

`pnpm run setup`/`pnpm run dev` never fail on missing Android/iOS tooling — see "Mobile" above.

## Troubleshooting

**"Docker CLI not found" / "Docker engine did not become ready"** — Install Docker Desktop
(Windows/macOS) or start the daemon yourself (Linux: `sudo systemctl start docker`) and re-run.
`tools/dev/bootstrap.mjs` starts Docker Desktop for you on Windows/macOS if the CLI exists but the
engine isn't running yet; it does not attempt this on Linux, where the daemon is normally
systemd-managed and starting it needs privileges this script shouldn't assume.

**"Backend repository not found"** — Clone `patheya-express-platform` as a sibling of `frontend/`
(see "Repository relationship" above), or pass `--skip-infrastructure` if you're intentionally
pointed at a different backend (the launcher's own `--env=qa`/`staging`/`production`, for example).

**"Backend reachable but reporting degraded status" / "...returned an invalid health response"** —
See `tools/launcher/README.md`'s troubleshooting section — this is the launcher's own diagnostic,
reused as-is by `tools/dev/bootstrap.mjs`.

**Port 3000 (or 4200/4201/4202/4203) already in use** — For 3000: check
`docker compose -f infrastructure/docker/docker-compose.yml ps` in the backend repo first — if
`api-gateway` is already `Up`, that's expected and correct; nothing else should also be bound to
3000. If something *else* owns 3000 (an old native `pnpm start:dev`, another project) and answers
with something other than the expected health contract, `detectBackend()` (see
`tools/launcher/lib/detect-backend.mjs`) reports it as an "invalid health response" and, **on
Windows**, attempts to name the occupying process (via `netstat`/`tasklist`) in that diagnostic —
e.g. "Port 3000 is occupied by: node.exe (PID 1234)." On macOS/Linux this identification is a known,
documented limitation (not implemented): a reliable equivalent needs a different real command per
OS (`lsof`/`ss`), and this tooling deliberately doesn't grow OS-specific implementations for a
diagnostic-only nice-to-have — the message falls back to naming the port and pointing you at
`curl <url>/api/v1/health` to inspect it yourself. For 4200-4203: another `nx serve` (yours or a
teammate's, if sharing a machine) is likely already running that app.

**Dependency installation failure** — Re-run `pnpm run setup` after fixing the underlying error
shown in the `pnpm install` output; both repos' installs are idempotent and safe to retry.

**Wrong Node/pnpm version** — Each repo pins its own version (`frontend/package.json`'s
`packageManager` field; the backend's `devEngines.packageManager`) — see "pnpm version policy"
above for why they're allowed to differ and how `pnpm run setup` reports both.

**Backend database migration failed** — Non-fatal by design (`pnpm run setup` still starts the
frontend afterward) — fix the error shown, then run
`pnpm --filter api-gateway run db:migrate` yourself from `patheya-express-platform`.

**Prisma asks a question during migration** — `pnpm run setup` runs `prisma migrate dev` with its
output/input connected directly to your terminal (not captured or auto-answered by this tooling).
On a genuinely fresh database this shouldn't happen — there's no prior schema to have drifted from —
but if Prisma ever detects drift and asks for confirmation before a destructive reset, that prompt
is real and waiting for you, not something this script suppressed or answered on your behalf.
Answer it based on your own judgment of the data in that database.

## Testing

```bash
pnpm run test:dev        # tools/dev/'s own tests (arg parsing, guard rails)
pnpm run test:launcher   # tools/launcher/'s tests (health parsing, tool checks, ...) — reused, not duplicated
```

## Bootstrap v5 migration

What moved where, from `Patheya-Express-Developer-Bootstrap-v5`:

| Bootstrap v5 had | Now |
|---|---|
| `windows/verify-environment.ps1` + `mac/verify-environment.sh` (two implementations) | `tools/launcher/lib/validate-environment.mjs`'s `buildToolChecks` — one implementation, called from `tools/dev/bootstrap.mjs` |
| `windows/start-dev.ps1` + `mac/start-dev.sh` (two implementations) | `tools/dev/bootstrap.mjs` — one implementation, run identically via `node` on any OS |
| Docker Desktop detection/start (Windows-specific `Start-Process`) | `tools/dev/bootstrap.mjs`'s `ensureDockerEngineRunning()` — same idea, now also covers macOS (`open -a Docker`), and gives Linux users an actionable message instead of silently doing nothing |
| `docker compose up -d` + health wait, no duplicate `start:dev` | `tools/launcher/lib/detect-backend.mjs`'s `detectBackend()`, called from both `tools/dev/bootstrap.mjs` and the launcher itself — the exact fix for the `EADDRINUSE` incident lives in one place |
| `windows/bootstrap.ps1`'s winget-based tool *installation* (Git/Node/Docker/Chrome/Android Studio via `winget`) | **Deliberately not migrated.** Auto-installing system packages non-interactively from a cloned repo is inappropriate for shared enterprise tooling — a new hire's machine shouldn't have arbitrary installs triggered by `pnpm run setup`. This doc's "Troubleshooting"/"Required vs. optional tooling" sections give the same information (what's needed, where to get it) without the script doing it for you. |
| ADB / ADB-on-PATH check | Unchanged — still `tools/launcher/lib/validate-environment.mjs`'s Android-only check, run when targeting `android`, not part of `pnpm run setup`'s web-scope checks (see "Mobile" above) |
| Chrome detection | Not migrated — no script in this repo currently launches or requires Chrome specifically; `--browser` on the launcher opens the OS-default browser. |
| A folder outside any Git repository | This directory — versioned, reviewed, and released the same way as any other change to this repo |

The external `Patheya-Express-Developer-Bootstrap-v5` folder can be archived once this is adopted;
nothing in this repo depends on it any longer.
