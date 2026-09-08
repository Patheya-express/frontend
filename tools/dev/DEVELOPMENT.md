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

## 0. System prerequisites (the one thing this tooling genuinely cannot automate)

Everything from here down assumes `pnpm run setup` can actually execute — and `pnpm` itself is the
one unavoidable bootstrap boundary: if `pnpm` isn't on PATH yet, no command that starts with `pnpm`
can run at all, this one included. Getting from a bare Windows machine to "`pnpm run setup` works"
is exactly four steps:

1. **Install Node.js 24.x** — https://nodejs.org (the LTS/current installer). Node ships Corepack
   (pnpm's version manager) built in; you don't install pnpm separately.
2. **Open a new terminal.** PowerShell/Command Prompt only pick up a PATH change (Node's install
   added itself to PATH) in windows opened *after* the installer finished — an already-open terminal
   still won't find `node`/`corepack`.
3. Verify: `node --version` should print `v24.x.x`.
4. **Enable Corepack, then verify pnpm:**
   ```powershell
   corepack enable
   pnpm --version
   ```
   This is the one step that can fail in a way worth knowing about ahead of time:

   **`corepack enable` fails with `EPERM: operation not permitted, open 'C:\Program Files\nodejs\yarn'`**
   — Node is installed under `C:\Program Files\nodejs`, and a non-elevated terminal can't write
   there. Fix: open **one** elevated terminal, run Corepack there, then go back to a normal
   terminal for everything else — Corepack's own change (a few shim files under `Program Files`)
   is a one-time, machine-wide setup step, not something that needs elevation every time:
   ```powershell
   # In an elevated ("Run as Administrator") PowerShell:
   corepack enable
   # Close that window. Back in a normal terminal:
   pnpm --version
   ```
   Never weaken PowerShell's execution policy machine-wide to work around this — it isn't the
   actual problem (the actual problem is a file permission, not a blocked script) and it's a much
   larger, harder-to-undo change than opening one elevated terminal once.

   **PowerShell blocks `npm.ps1`/`corepack.ps1` with an execution-policy error** (a different
   symptom than the EPERM above — this one happens when PowerShell's execution policy refuses to
   run *any* `.ps1` script, including the shims npm/Corepack install) — run the `.cmd` shim
   instead: `npm.cmd` / `corepack.cmd` in place of `npm`/`corepack`. The `.cmd` form isn't a
   PowerShell script and isn't subject to the execution policy at all, so this avoids ever having
   to change the policy (globally or otherwise).

   **Still stuck, or `corepack enable` isn't an option on this machine?** Install pnpm directly
   instead — this is an accepted, already-documented fallback, not a workaround of last resort:
   `npm install -g pnpm@11.5.3` (matching this repo's `packageManager` field). See root
   `README.md`'s Troubleshooting section for the same guidance in context.

Once `pnpm --version` prints something, every remaining prerequisite (Git, Docker Desktop) is
checked *for you* by `pnpm run setup` itself (Step 1 below reports exactly what's missing, with a
link to install it) — there's nothing else to manually verify first.

**Do not run `pnpm install` yourself before `pnpm run setup`.** It isn't wrong to (pnpm installs
are idempotent — a second one just reports "Already up to date" in under a second), but it's
unnecessary: `pnpm run setup`'s own first step installs both this repo's and the backend's
dependencies as the one authoritative install path. Running it manually first just means you see
the same install happen twice, which reads as a bug the first time you notice it — it isn't one.

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
| Local environment/secret file utilities (dependency-free) | `frontend/tools/dev/lib/env-file.mjs` | `ensureEnvFile`/`ensureLocalSecrets`/`generateSecret`/`isPlaceholderValue` — pure file-system helpers, owned by neither of the two directories below on their own; **consumed by both** (see next paragraph). |

`tools/dev/bootstrap.mjs` is deliberately thin: it never re-implements health parsing, tool
checks, or app selection — it imports and calls the launcher's own modules
(`detectBackend`, `buildToolChecks`, `log`, `exec`) for all of that. There is exactly one
implementation of "what does a healthy backend response look like" in this whole system:
`tools/launcher/lib/detect-backend.mjs`.

**The dependency graph between these two directories is not strictly one-directional.** The
sequencing/health-check relationship above (`tools/dev` calls into `tools/launcher`) is the primary
one, but `tools/launcher/lib/detect-backend.mjs` also imports `tools/dev/lib/env-file.mjs` — because
`detectBackend()`'s own `startSiblingBackend()` is the one and only place that actually runs `docker
compose up`, and that command needs a real, non-placeholder `infrastructure/docker/.env.compose` to
succeed regardless of which entry point triggered it. A developer who runs `pnpm customer:web`
directly, having never run `pnpm run setup` at all, still needs that guarantee. Rather than
duplicating the scaffold-and-generate-secrets logic into `tools/launcher` (or promoting it to a
brand-new shared package neither directory currently has a second use for), `env-file.mjs` is kept
as what it already was — a small, dependency-free, side-effect-scoped leaf module with no knowledge
of either directory's own concerns — and imported directly by whichever of the two needs it. Neither
directory's actual *responsibility* changes: `tools/dev` still owns first-time setup sequencing
end-to-end, and `tools/launcher` still owns backend detection and startup on its own — the only
thing genuinely shared is this one small, pure, local-config utility.

## Docker architecture

```text
Docker Desktop
    │
    ▼
Docker Compose (patheya-express-platform/infrastructure/docker/docker-compose.yml)
    │
    ├── PostgreSQL  :15432 (host) → :5432 (container)  ← see "Why 15432, not 5432?" below
    ├── Redis       :6379
    ├── Kafka       :9092   (present only because an env var requires it — unused by app code)
    ├── Zookeeper
    └── API Gateway :3000   ← the only backend process. Built from the backend repo's root
                               Dockerfile, published on 3000 by Compose itself.
```

`api-gateway` always talks to `postgres:5432` over the internal Compose network — the host-side
`15432` mapping only exists for tools running on your machine (Prisma CLI, `psql`, a GUI client).

**There is exactly one process on port 3000, ever: the Compose-managed `api-gateway` container.**
Nothing in this repo's tooling — not `tools/launcher`, not `tools/dev/bootstrap.mjs` — starts a
second one. `tools/launcher/lib/detect-backend.mjs`'s own local auto-start runs `docker compose up
-d` and stops there; it deliberately does **not** also run `pnpm --filter api-gateway start:dev`,
because that raced the container for the same port in an earlier version of this tooling and
produced `EADDRINUSE :::3000`. If you intentionally want api-gateway running natively on the host
instead of in a container (faster inner-loop iteration on backend code), exclude it from Compose
yourself and pass `--skip-infrastructure` — see "Backend-only" below.

### Local secrets (JWT)

The Docker-managed `api-gateway` container reads its `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` from
`patheya-express-platform/infrastructure/docker/.env.compose` — via `docker-compose.yml`'s
`${JWT_ACCESS_SECRET}`/`${JWT_REFRESH_SECRET}` substitution, and every `docker compose up` this
tooling runs passes `--env-file infrastructure/docker/.env.compose` explicitly (see
`tools/launcher/lib/detect-backend.mjs`'s `startSiblingBackend()`) — never relying on Compose's own
same-directory `.env` auto-discovery, since the file is deliberately not named `.env`. This is a
completely separate file from `apps/api-gateway/.env` (host-side tools only); see "Environment
configuration" below for both.

Neither file exists on a fresh clone — only their committed, itself-gitignored `.env*.example`
templates do — and both templates ship literal placeholder secrets
(`replace-with-a-long-random-value` / `dev-access-secret-change-me`) that the backend's own
`env.validation.ts` rejects at boot in *every* environment, including development. Without this
step, the container crash-loops on `"JWT_ACCESS_SECRET" still contains an unedited placeholder
value` before ever reaching a state this tooling's health check could report anything useful about.

`pnpm run setup` (and, independently, the frontend launcher's own auto-start — see
`startSiblingBackend()`) fixes this automatically:

- Scaffolds each `.env*` file from its `.example` template if missing — a plain file copy, never
  overwriting a file that already exists.
- Generates a real, cryptographically random secret (48 bytes, base64url) for any secret key that's
  missing, empty, or still one of the known placeholder strings — **idempotent**: an already-valid
  secret from a previous run, or one you set yourself, is never regenerated or rotated.
- **Never prints, logs, or returns the generated value anywhere** — only which keys were touched
  (e.g. "Local development secrets generated (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET)"). If you need
  the actual value (e.g. to decode a token by hand), read the file yourself:
  `infrastructure/docker/.env.compose`.

This is implemented once, in `tools/dev/lib/env-file.mjs` (`ensureLocalSecrets`/`generateSecret`/
`isPlaceholderValue`) — both `tools/dev/bootstrap.mjs` and `tools/launcher/lib/detect-backend.mjs`
call the same functions, so a developer who never runs `pnpm run setup` at all (just `pnpm
customer:web` straight after cloning) gets the identical guarantee the moment the launcher tries to
auto-start the backend.

**If `docker compose up` itself fails** (a missing `--env-file` target, Docker Desktop not actually
ready, a build error), `startSiblingBackend()` checks its exit code directly and reports the failure
immediately — never logging a false "Started `docker compose up -d`..." success message, and never
waiting out the health-poll timeout for a backend that was never actually started. **If Compose
succeeds but the api-gateway container still won't come up**, `detectBackend()`'s health poll
detects a genuine crash-loop (Docker reports the container status as `restarting`) within a few
seconds — well before its full startup timeout — and attaches the container's status plus its last
~40 log lines to the failure message. Either way, any `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` value
appearing in that attached output is redacted before it reaches the terminal.

### Ports

| Service | Port | Owned by |
|---|---|---|
| API Gateway | `3000` | Docker Compose (`patheya-express-platform`) |
| Customer App | `4200` | `nx serve customer-app` (this repo) |
| Partner/Restaurant App | `4201` | `nx serve restaurant-app` |
| Admin App | `4202` | `nx serve admin-app` |
| Delivery App | `4203` | `nx serve delivery-app` |
| PostgreSQL | `15432` (host) → `5432` (container) | Docker Compose |
| Redis | `6379` | Docker Compose |
| Kafka | `9092` | Docker Compose (unused by application code) |

(Verified against `patheya-express-platform/infrastructure/docker/docker-compose.yml` and this
repo's `tools/launcher/lib/registry.mjs`'s `defaultPort` per app.)

### Why 15432, not 5432?

A native PostgreSQL install (common on Windows, also possible on macOS/Linux) commonly already
owns port 5432 on a developer's machine. If Docker Compose's `postgres` container also tried to
publish on 5432, the two race for the same host port — sometimes Docker wins the bind, sometimes
the native server does, non-deterministically depending on start order — and whichever one *isn't*
currently holding the port is invisible to host-side tools even though `docker ps`/`docker exec`
still work fine against the container directly. That produced exactly this incident: `prisma
migrate status` reported "up to date" against whichever server `localhost:5432` happened to
resolve to, while the actual Docker database (queried via `docker exec`) had no tables at all.

The fix is to never let them contend for the same port: Compose publishes `postgres` on host port
**15432** instead, while the container itself still listens on 5432 internally — `api-gateway`
inside Compose still connects to `postgres:5432` and is completely unaffected. **You do not need
to uninstall or stop a native PostgreSQL install** — it can keep running on 5432 exactly as
before; Docker Compose no longer touches that port at all. This is purely a local-development
change — production database connectivity (`k8s/`, Render, Neon, etc.) never went through this
Compose file and is unaffected.

Only using `patheya-express-platform/scripts/start-dev.ps1`'s native-Postgres workflow instead of
Docker Compose? That path assumes a native PostgreSQL install on the standard port 5432 and reads
the same `apps/api-gateway/.env` this tooling scaffolds — since that file's checked-in default now
points at Docker's port, set `DATABASE_URL` back to `localhost:5432` in your own `.env` if you use
that path instead of `pnpm run setup`/`pnpm run dev`.

**Already have a Docker `postgres` volume from before this change?** Its data isn't affected — the
port a container publishes is a run-time setting, not something stored in the volume, so
`docker compose down` (which removes containers, not volumes, unless you pass `-v`) followed by
`docker compose up -d` recreates the same containers attached to the same `postgres-data` volume,
now published on 15432 instead of 5432. Nothing here runs `docker compose down -v`, `docker volume
rm`, or any Prisma command more destructive than `migrate dev`, so existing local data survives
this change. If your own `apps/api-gateway/.env` already has a `DATABASE_URL` (it's gitignored and
never overwritten by this tooling — see `ensureEnvFile` in `tools/dev/lib/env-file.mjs`), you'll
need to update it to `localhost:15432` yourself; only a fresh `.env` scaffolded from
`.env.example` after this change picks up the new default automatically.

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
3. **Preparing local development configuration.** Scaffolds two separate, gitignored local config
   files — neither exists on a fresh clone, only their committed `.example` templates do — and
   never overwrites either if it's already there:
   - `patheya-express-platform/apps/api-gateway/.env` (from `.env.example`) — for host-side tools
     (Prisma CLI, a native `start:dev`). Its defaults already match Compose's Postgres/Redis/Kafka
     ports, including `DATABASE_URL` pointing at `localhost:15432` (see "Why 15432, not 5432?").
   - `patheya-express-platform/infrastructure/docker/.env.compose` (from `.env.compose.example`) —
     what the **Docker-managed api-gateway container itself** actually reads (see "Docker
     architecture" and "Local secrets" below).

   Both files ship placeholder JWT secrets (`replace-with-a-long-random-value` /
   `dev-access-secret-change-me`) that the backend's own startup validation rejects outright, in
   *every* environment — so immediately after scaffolding, this step also generates a real,
   cryptographically random `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` for each file, replacing only
   the placeholder (never a value you or a previous run already set for real) and never printing
   the generated value anywhere. See "Local secrets (JWT)" below for the full contract.
4. **Backend Prisma Client generation** (`pnpm --filter api-gateway run db:generate`, i.e. `prisma
   generate`) — needs only the checked-out `schema.prisma`, not a reachable database, so this runs
   before Docker/Postgres is even started. Neither `prisma` nor `@prisma/client` runs this
   automatically as part of `pnpm install` (no `postinstall` hook exists in either package), so a
   fresh clone's `@prisma/client` is otherwise a generic, pre-generated stub that doesn't match this
   checkout's schema at all — the direct cause of errors like `Module '"@prisma/client"' has no
   exported member 'UserRole'` the first time anything (in practice, the seed script below) imports
   it. Fatal on failure: everything from here on either imports the generated client directly or
   depends on it transitively.
5. Starts Docker Desktop if it isn't running yet, then `docker compose up -d` (Postgres, Redis,
   Kafka, Zookeeper, api-gateway) — using `--env-file infrastructure/docker/.env.compose` explicitly
   (never relying on Compose's own same-directory `.env` auto-discovery, since this file is
   deliberately not named `.env` — see "Local secrets" below).
6. Waits for `GET /api/v1/health` to report `{success: true, data: {status: "ok", ...}}` — via the
   frontend launcher's own `detectBackend()`, not a second implementation. Bounded and
   deterministic: if the api-gateway container starts crash-looping instead of becoming healthy
   (Docker reports that as container status `restarting`), this fails fast — a few seconds, not the
   full timeout — with the container's actual status and its last ~40 log lines attached, so you
   don't have to go find `docker logs` yourself. See "Backend fails to become healthy" below.
7. Runs backend database migrations (`pnpm --filter api-gateway run db:migrate`, i.e. `prisma
   migrate dev` — never `migrate reset` or `db push`) — first-time only, never on daily startup (an
   unmigrated database still reports "healthy," since the health check is a raw connectivity probe,
   not a schema check). Runs with your terminal attached, so if Prisma ever needs to ask a
   confirmation question, you see and answer it yourself — see "Prisma asks a question" below.
   Then independently verifies, against the Docker `postgres` container itself, that
   `_prisma_migrations` and the `users` table actually exist — `prisma migrate dev` reporting
   success only proves *some* reachable PostgreSQL server has that migration history applied, not
   that it's the same server the Docker `api-gateway` container uses (see "Why 15432, not 5432?"
   above for the incident this catches). Unlike a migration command failure, this verification
   failing **stops setup** with a clear diagnosis rather than continuing to a frontend launch that
   would just fail registration with `public.users does not exist`.
8. Runs the backend's development database seed (`pnpm --filter api-gateway run db:seed`) —
   first-time only, same non-fatal contract as migrations (a failure warns and tells you the
   manual command rather than blocking setup). Populates development-only baseline data: seeded
   role accounts, restaurants/menus, delivery partners, orders, coupons, offers, and FAQs — so a
   fresh clone is immediately usable end-to-end, not just an empty, migrated schema. Deterministic
   and idempotent (safe to re-run); never real credentials or production data — see
   `patheya-express-platform/apps/api-gateway/README.md`'s "Database seed" section for the full
   seeded account list.
9. Starts the Customer App via the frontend launcher.

Only failures print guidance and stop the flow — nothing fails silently. Verified against an actual
zero-`node_modules` fresh clone in a scratch directory (not just this repeated on an
already-set-up machine) — see this change's validation record.

### Daily startup

```bash
pnpm run dev
```

(→ `node tools/dev/bootstrap.mjs customer`, i.e. the same steps minus dependency install, `.env`
scaffolding, migrations, and the database seed — those are one-time, not daily.) Every step it does run is idempotent:
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
- **Backend, host-side tools** (Prisma CLI, a native `start:dev`):
  `patheya-express-platform/apps/api-gateway/.env`, scaffolded from `.env.example` by `pnpm run
  setup` (step 3 above) if missing.
- **Backend, the Docker-managed api-gateway container itself**:
  `patheya-express-platform/infrastructure/docker/.env.compose` — a *different* file, scaffolded
  from `.env.compose.example`, also by step 3 above. See "Local secrets (JWT)" above for exactly
  why these are two separate files and what each is for.

  Both: never committed (already gitignored in that repo — `.env*` is the ignore pattern, with an
  explicit `!.env.example`/`!**/.env.compose.example` exception for the checked-in templates only);
  never printed by any script here, generated secrets included. Every other value in both templates
  already matches `docker-compose.yml`'s Postgres/Redis/Kafka defaults, so the scaffold-plus-
  generate-secrets step above is sufficient to migrate and develop locally on its own — real values
  (Razorpay, SMTP, Cloudinary) are only needed for those specific flows and are never invented by
  this tooling: if you need one of those, the relevant feature will tell you exactly which
  environment variable it's missing when you first exercise it, not before.

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

**"JWT_ACCESS_SECRET still contains an unedited placeholder value"** (in `docker logs
patheya-express-api-gateway`, or as a crash-loop diagnostic attached to a "did not become healthy"
failure) — `pnpm run setup`/the launcher's auto-start generate a real secret into
`infrastructure/docker/.env.compose` automatically (see "Local secrets (JWT)" above), so seeing
this means that step didn't run or was bypassed — most often because Docker Compose was invoked by
hand without `--env-file infrastructure/docker/.env.compose`. Fix: re-run `pnpm run setup` (or
`pnpm run dev`), or run `docker compose -f infrastructure/docker/docker-compose.yml --env-file
infrastructure/docker/.env.compose up -d` yourself from `patheya-express-platform`.

**"Docker Compose failed to start the local backend stack"** — `docker compose up -d` itself exited
non-zero (a missing `--env-file` target, Docker Desktop not actually running despite the engine
check passing, a build error, etc.) — distinct from the container-crash-loop case below: here,
`docker compose up` never even succeeded, so no containers were necessarily created at all. Reported
immediately (well under a second), never after waiting out the health-poll timeout, with the
command's own output attached (any `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` value redacted from
that output automatically). If the message specifically says `infrastructure/docker/.env.compose`
does not exist, that means the checkout is missing its own `.env.compose.example` template (this
tooling scaffolds `.env.compose` from that template automatically; if the template itself isn't
there, the checkout is incomplete) — confirm the backend clone completed successfully and re-run.

**"The api-gateway container is crash-looping"** — Compose itself succeeded (containers were
created and started), but `detectBackend()`'s health poll then noticed the container status is
`restarting` (Docker's own signal that it started, exited, and is being auto-restarted by `restart:
unless-stopped`) several times in a row, and stopped waiting out the full timeout for a container
that isn't coming back on its own. The attached diagnostic (container status + last ~40 log lines)
usually names the actual rejected value directly; the full log is `docker compose -f
infrastructure/docker/docker-compose.yml logs api-gateway` from `patheya-express-platform`.

**Dependency installation failure** — Re-run `pnpm run setup` after fixing the underlying error
shown in the `pnpm install` output; both repos' installs are idempotent and safe to retry.

**"Module '@prisma/client' has no exported member '...'" / a Prisma enum member is `undefined` at
runtime** — The generated Prisma Client is out of sync with the checked-out `schema.prisma`.
`pnpm run setup` runs `pnpm --filter api-gateway run db:generate` explicitly for exactly this reason
(neither `prisma` nor `@prisma/client` regenerates it automatically on `pnpm install` — see step 4
above) and treats its failure as fatal; if you still hit this (e.g. after manually running the seed
script, or switching branches with a schema change), re-run it yourself:
`pnpm --filter api-gateway run db:generate` from `patheya-express-platform`.

**Wrong Node/pnpm version** — Each repo pins its own version (`frontend/package.json`'s
`packageManager` field; the backend's `devEngines.packageManager`) — see "pnpm version policy"
above for why they're allowed to differ and how `pnpm run setup` reports both.

**Backend database migration failed** — Non-fatal by design (`pnpm run setup` still starts the
frontend afterward) — fix the error shown, then run
`pnpm --filter api-gateway run db:migrate` yourself from `patheya-express-platform`.

**Backend database seed failed** — Also non-fatal by design, same reasoning as a migration
failure — fix the error shown, then run `pnpm --filter api-gateway run db:seed` yourself from
`patheya-express-platform`. Safe to re-run: the seed is idempotent, so retrying never duplicates
data.

**"Migrations reported success, but the Docker PostgreSQL container is missing..."** — This is the
post-migration database verification (see "Why 15432, not 5432?" above), and unlike a bare
migration failure, it's fatal by design: it means `DATABASE_URL` in
`patheya-express-platform/apps/api-gateway/.env` resolved to a PostgreSQL server other than the
Docker `postgres` container — most often a native PostgreSQL install answering on the same port.
Fix `DATABASE_URL` to point at Docker's published port (default `localhost:15432`) and re-run
`pnpm run setup`. This never deletes or resets any existing database — it only reads.

**"Host tools cannot reach PostgreSQL at ..."** — The same verification failing at the connectivity
stage: nothing is listening at the host/port your `.env`'s `DATABASE_URL` names at all. Confirm
Compose actually published Postgres there: `docker compose -f infrastructure/docker/docker-compose.yml
port postgres 5432` (run from `patheya-express-platform`) should print `0.0.0.0:15432`.

**Prisma asks a question during migration** — `pnpm run setup` runs `prisma migrate dev` with its
output/input connected directly to your terminal (not captured or auto-answered by this tooling).
On a genuinely fresh database this shouldn't happen — there's no prior schema to have drifted from —
but if Prisma ever detects drift and asks for confirmation before a destructive reset, that prompt
is real and waiting for you, not something this script suppressed or answered on your behalf.
Answer it based on your own judgment of the data in that database.

## Testing

```bash
pnpm run test:dev        # tools/dev/'s own tests (arg parsing, guard rails, database verification, seed step ordering)
pnpm run test:launcher   # tools/launcher/'s tests (health parsing, tool checks, ...) — reused, not duplicated
```

`tools/dev/test/db-verify.test.mjs` covers the post-migration database verification's parsing and
port-probing logic in isolation (no Docker required); the verification's actual `docker compose
exec psql` call is exercised by running `pnpm run setup` for real, same as the rest of this file's
Docker-dependent behavior.

`tools/dev/test/env-file.test.mjs` covers the local-secrets generation contract in full, without
Docker or either backend file: placeholder detection (`isPlaceholderValue`), secret generation
(`generateSecret` — length, character set, never colliding), single-key read/write
(`readEnvVar`/`setEnvVar` — never touching unrelated lines), and the end-to-end idempotent behavior
(`ensureLocalSecrets` — generates once for a placeholder/missing key, preserves an already-valid
one forever after, two consecutive calls produce byte-identical output on the second). `tools/dev/
test/bootstrap.test.mjs` covers the wiring around it at the source level: the compose env-file step
and Prisma Client generation both run before the "Step 2 — Local infrastructure (Docker Compose)"
section even starts (checked against the Step 2 section header and the `ensureDockerEngineRunning`/
`detectBackend` call sites directly, not merely "before db:migrate" — the actual FIFTH
FRESH-MACHINE FAILURE regression this guards against is generate running only *after* Docker/backend
health, not merely after db:migrate), both are fatal on failure, and a generated secret's value is
never passed to a `log.*` call. `tools/launcher/test/detect-backend.test.mjs` covers
`buildComposeUpArgs()` (the exact `--env-file`/`-f` argv `docker compose up` is invoked with — the
regression test for the THIRD FRESH-MACHINE FAILURE), `formatDiagnosticsBlock()` (the crash-loop
diagnostic renderer), and `redactSecrets`/`isMissingEnvFileError`/`formatComposeFailureDiagnostics`
(the Compose-exit-code-checking path — real, non-mocked inputs including the literal stderr text a
real `docker compose --env-file <missing>` invocation was verified to produce) directly, without
needing a real Docker container to crash-loop or a real Docker daemon at all.

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
