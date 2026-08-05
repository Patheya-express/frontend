# Unified launch commands

One command to validate your environment, make sure the backend is reachable, build, sync
Capacitor, and launch — for web, Android, or iOS — for any of the four apps. Plus `pnpm doctor`,
a full diagnostic sweep across every app and every tool at once.

```bash
pnpm customer:web
pnpm customer:android
pnpm customer:ios

pnpm partner:web        # restaurant-app — see the "partner" naming note below
pnpm partner:android
pnpm partner:ios

pnpm delivery:web
pnpm delivery:android
pnpm delivery:ios

pnpm admin:web           # admin-app is web-only, by design (see docs/mobile/CAPACITOR.md)

pnpm doctor              # full diagnostic report — every app, every tool, one run
```

Or call the launcher directly for anything the aliases don't cover:

```bash
node tools/launcher/cli.mjs <app> <platform> [options]
# app: customer | partner | delivery | admin
# platform: web | android | ios
```

## Architecture

```
tools/launcher/
  cli.mjs                    entry point — arg parsing, pipeline orchestration, dashboard
  doctor.mjs                 pnpm doctor — full diagnostic sweep, no app/platform required
  lib/
    log.mjs                  levels (SUCCESS/ERROR/WARN/INFO/DEBUG/TRACE), dashboard, output capture
    exec.mjs                 cross-spawn-backed process runner (capture / inherit / inherit+capture)
    registry.mjs              declarative APPS / ENVIRONMENTS / DEVICE_PROFILES — the single
                               source of truth every other module reads from
    pipeline.mjs               Stage abstraction + runPipeline() orchestrator (validate → execute →
                               summary/error), with built-in support for parallel stage groups
    stages.mjs                 the launcher's actual stages (Environment, Backend, Build, Sync),
                               each wrapping one of the modules below
    validate-environment.mjs   Step 1 — tool checks + app checks (shared with doctor.mjs)
    detect-backend.mjs         Step 2 — real health-endpoint polling, optional local auto-start
    verify-build.mjs           Step 3 — delegates to `nx build`, detects cache hit/miss
    sync-native.mjs            Step 4 — delegates to `cap sync`, with its own change-detection cache
    devices.mjs                 Android/iOS device detection + interactive picker + profile filtering
    launch.mjs                  Step 5 — resolves a target (device/browser/IDE), then invokes it
  README.md
```

### The pipeline

Every launch runs a fixed sequence of **stages** (`lib/pipeline.mjs`). A stage is a plain object:

```js
{
  name: 'Backend',
  applies(ctx) { return true },       // should this stage even run for this ctx?
  async execute(ctx) { ... },         // does the work, returns {ok, ...}
  summary(result) { return [[label, value], ...] },  // dashboard rows on success
  error(result) { return {rootCause, suggestedFix, ...} },  // guidance on failure
}
```

`runPipeline()` walks a list of entries in order, where each entry is either one stage or an
**array** of stages to run concurrently. The launcher's own pipeline
(`lib/stages.mjs#buildPipeline`) is:

```
[[Environment, Backend], Build, Sync]
```

Environment and Backend run in parallel (neither depends on the other). Build depends on both
having succeeded; Sync depends on Build. Adding a future stage means adding one `createStage()`
call to that array — `runPipeline()` never special-cases a stage by name, and the CLI never
changes to accommodate a new one.

**Launch is not a pipeline stage.** `nx serve`/`cap run`/`cap open` are long-running — they don't
return until you stop them. If Launch were a pipeline stage, the dashboard (which is meant to
appear the moment everything is *ready*) would only print after you closed the dev server. Instead
`lib/launch.mjs` splits into `resolve()` (fast — figures out which device/browser/IDE this run
targets) and `invoke()` (slow — the actual blocking command). `cli.mjs` calls `resolve()`, prints
the dashboard with the real resolved device in it, *then* calls `invoke()`.

### Parallel output, without interleaved noise

Running Environment and Backend concurrently means two stages' `console.log` calls would
naturally race line-by-line into unreadable interleaved output. `lib/log.mjs` uses
`node:async_hooks`'s `AsyncLocalStorage` (not a naive global `console.log` swap, which breaks
under real concurrency — a second stage starting before the first finishes steals the redirect) to
buffer each concurrently-running stage's output separately, then flush every stage's lines
together, in stage-declaration order, once the whole parallel group finishes. The stages still run
genuinely in parallel — only the printing is reordered for readability.

### Doctor vs. the launcher

`pnpm doctor` reuses the exact same check-building functions as Step 1
(`buildToolChecks`/`buildAppChecks` in `validate-environment.mjs`) and the exact same
`detectBackend` as Step 2 — no duplicated logic, per the hardening brief's own rule. The
difference is scope and behavior: the launcher validates **one** app+platform+environment and
**stops at the first failure** (so you fix one thing and re-run); doctor checks **every** app and
**every** platform-specific tool at once and **never stops early** (so you get the full picture in
one run). Doctor is also always read-only — it never auto-starts the backend, unlike the launcher
in `local` mode.

## Environment selection

```bash
pnpm customer:web --env=local        # default
pnpm customer:web --env=qa
pnpm customer:android --env=staging
pnpm customer:ios --env=production
```

`local`, `qa`, `staging`, `production` map to this repo's existing `environment.*.ts` files and Nx
build/serve configurations — nothing new was added to that mechanism.

**Native (`android`/`ios`) builds always use the existing `mobile` build configuration regardless
of `--env`.** Only one mobile-pointed environment file exists today (`environment.mobile.ts`,
intentionally QA-pointed — see `docs/mobile/CAPACITOR.md` §10, since a device/emulator can't
resolve the host machine's `localhost`). Wiring up per-environment native builds is a real,
reasonable follow-up, but it's an architecture change to a completed feature — deliberately out of
scope here, same reasoning as not guessing real values for `environment.prod.ts`.

## Device profiles

```bash
pnpm customer:android --profile=pixel
pnpm customer:android --profile=emulator
pnpm partner:ios --profile=simulator
```

| Profile | Matches |
|---|---|
| `pixel` | Android device/emulator whose name contains "Pixel" |
| `tablet` | Android device/emulator whose name contains "Tab"/"Tablet" |
| `fold` | Android device/emulator whose name contains "Fold" |
| `emulator` | Any running Android emulator |
| `iphone` | Any device/simulator whose name contains "iPhone" |
| `ipad` | Any device/simulator whose name contains "iPad" |
| `simulator` | Any iOS simulator |
| `physical` | Any physical (non-emulator, non-simulator) device |

A profile narrows the candidate list before the existing `--device`/`--emulator` flags and the
interactive picker apply — it's a preference layered on top of the existing selection flow, not a
replacement for it. If nothing connected matches the profile, the launcher falls back to showing
every candidate (with a warning) rather than dead-ending with zero options. Profiles are declared
in `lib/registry.mjs`'s `DEVICE_PROFILES` — adding one is a single entry, a label and a `(device)
=> boolean` matcher.

## What each launch does

1. **Environment validation** (parallel with Backend) — every applicable check from
   `validate-environment.mjs` runs concurrently: Node/pnpm/Nx versions, Git, GitHub CLI (optional),
   Docker (optional), workspace integrity, the app's environment files, Capacitor config and native
   project (native only), Java/Gradle/Android SDK (Android only), Xcode/CocoaPods (iOS only, macOS
   only), and app configuration — Google Maps key, Firebase config file, media/Cloudinary base URL,
   Razorpay key (only required for `customer`; the other three apps carry the field but never
   consume it, so it's a warning there, not an error), Socket URL, API URL, and environment
   consistency (placeholder values, localhost-in-production) for non-local environments. Every
   check reports Root Cause / Fix / Documentation link — nothing fails silently. Warnings (⚠)
   don't block launch; only errors (✖) do.
2. **Backend detection** (parallel with Environment) — hits the backend's real health endpoint,
   `GET /api/v1/health`, which already reports `database`/`redis`/`queues`/`websocket` status (see
   `HealthResponseDto` in `@patheya-express-frontend/api-sdk`). This is why there's no separate
   "check Postgres" / "check Redis" step: the backend's own health endpoint is the accurate source
   for that, not something this repo can determine independently (it has no DB/Redis credentials).
   - `local`: if unreachable and a sibling `patheya-express-platform` checkout exists next to this
     repo, runs the exact commands `infrastructure/docs/local-development-guide.md` documents
     (`docker compose ... up -d` then `pnpm --filter api-gateway start:dev`) and polls until
     healthy or a 60s timeout. If that sibling repo isn't found, prints the guide's manual steps
     instead of guessing a path. `--no-backend-start` skips auto-start entirely.
   - `qa`/`staging`/`production`: only ever validates connectivity — never starts anything locally.
3. **Build verification** *(native only — the web dev server builds on the fly, so there's no
   separate artifact to check)* — delegates to `nx build`, which has its own input-hash build
   cache; this step doesn't reimplement staleness detection, only detects (for the dashboard's
   Build Cache row) whether Nx's own output said "existing outputs match the cache".
4. **Native synchronization** *(android/ios only)* — runs `cap sync` via the existing `cap-sync`
   Nx target, but skips it when none of the following changed since the last sync (tracked per-part
   in `node_modules/.launcher-cache/`, not committed): the installed Capacitor plugin set,
   `capacitor.config.ts`, `environment.mobile.ts`, Android resources (`res/`), iOS resources
   (`Assets.xcassets`), or the built web bundle. When a resync does run, it says *what* changed.
   `--clean` forces a resync regardless.
5. **Launch** — see the pipeline section above for why this isn't stage 5 of the pipeline itself.
   - `web`: `nx serve <app>` (streamed; add `--browser` to also open it).
   - `android`/`ios`: detects connected devices/running emulators/simulators (`adb devices -l`,
     `xcrun simctl`/`xctrace`), narrows by `--profile` if given, prompts if more than one candidate
     remains, then `cap run <platform> --target=<id>`. Zero devices found → opens Android Studio /
     Xcode instead. `--device=<id>` skips detection entirely; `--open` always opens the IDE.
6. **Dashboard** — Application / Platform / Environment / Backend + subsystem status / Build
   Cache / Capacitor Sync / Device / Setup Time, plus a separate per-stage timing breakdown.

## Options

| Flag | Effect |
|---|---|
| `--env=<local\|qa\|staging\|production>` | Target environment (default `local`) |
| `--no-build` | Skip Step 3 |
| `--no-sync` | Skip Step 4 |
| `--no-backend-start` | Never auto-start the local backend; only validate/wait |
| `--open` | Open the browser (web) or IDE (android/ios) instead of a direct device launch |
| `--device=<id>` | Launch directly to a specific device/emulator/simulator, skipping detection |
| `--profile=<name>` | Prefer a named device profile (see Device Profiles above) |
| `--emulator` | Prefer a running Android emulator when multiple devices are available |
| `--browser` | Open the system browser once the web dev server is ready |
| `--clean` | Force a Capacitor resync, ignoring the change-detection cache |
| `--watch` | Web: no-op (already watching). Native: not implemented — see below |
| `--verbose` | Print DEBUG/TRACE logs and full error stack traces instead of guidance-only summaries |

`--watch` isn't implemented for native targets: `cap run` doesn't support incremental resync on
file change, and building that well (a real file watcher + rebuild + resync loop) is a bigger
feature than DX-hardening scope. For live web-asset reload on a device, point
`capacitor.config.ts` at a dev server via the existing `CAP_SERVER_URL` mechanism instead — that's
the real live-reload path this repo already has (see `docs/mobile/CAPACITOR.md`).

## `pnpm doctor`

```bash
pnpm doctor
pnpm doctor --verbose
```

Runs, all concurrently: Development Tools (Node/pnpm/Nx/Git/gh/Docker/Java/Gradle/Android
SDK/Xcode/CocoaPods), each of the four apps' configuration (environment files, Capacitor, native
projects, Maps/Firebase/media/Razorpay/Socket/API), and the local backend's health. Prints the same
kind of dashboard the launcher does, plus a pass/warning/fail count and a per-section timing
breakdown. Exits non-zero if anything failed (errors, not warnings) — safe to use as a pre-flight
check in a script.

Doctor never modifies anything or starts any process — it's a pure diagnostic. If it tells you the
backend isn't reachable, run `pnpm customer:web` (or any app) instead, which *will* offer to start
it for `local`.

## Troubleshooting / FAQ

**"adb not found" / "ANDROID_HOME not set"** — Install Android Studio (or just the command-line
SDK tools) and make sure `platform-tools` is on `PATH`. `pnpm doctor` will tell you both of these
independently; fixing `ANDROID_HOME` alone doesn't put `adb` on `PATH` and vice versa.

**"iOS development requires macOS"** — There's no way around this; Xcode doesn't run on
Windows/Linux, and neither `xcodebuild` nor `xcrun` exist there. Target `web`/`android` instead, or
move to a Mac for iOS work.

**"Backend reachable but reporting degraded status"** — The health endpoint answered, but
`database`/`redis`/`queues`/`websocket` in the response isn't all-healthy. The launcher can't fix
this — it's an actual backend-side problem. Check the backend's own logs (in the sibling
`patheya-express-platform` repo).

**"Local backend not reachable, and the sibling repo was not found"** — The launcher looks for
`patheya-express-platform` as a sibling directory of this repo (`../patheya-express-platform`
relative to this checkout). If you've cloned it somewhere else, either move it, symlink it, or
start the backend manually per `infrastructure/docs/local-development-guide.md` and pass
`--no-backend-start`.

**Firebase configuration warning** — Expected until a Firebase project is set up (see the Sprint 5
release-readiness report). Push notifications won't work without it, but nothing else is affected;
this is a warning, not an error, and doesn't block any launch.

**Razorpay warning on partner/delivery/admin apps** — Expected. Only `customer-app` has a real
checkout/payment flow; the other three apps carry the field structurally (the shared
`AppEnvironment` interface requires it) but never read it.

**Google Maps API key missing (error)** — This one blocks, because the address picker genuinely
needs it. If `pnpm doctor` reports this for `qa`, check
`apps/<app>/src/environments/environment.qa.ts`'s `maps.googleMapsApiKey` — this has been found
empty there for at least `customer-app` (see `infrastructure/docs/secrets-guide.md` for how to set
real values).

### Windows

Everything here is plain Node (`.mjs`, ESM, built-in APIs) plus `cross-spawn` for correctly
escaped process spawning — no shell scripts. Process spawning goes through `cross-spawn` (the same
library npm/yarn use internally) rather than Node's own `shell: true`, which Node itself now warns
is unreliable for argument escaping on Windows (`DEP0190`) — this was a real bug caught by actually
running the tool here, not a hypothetical.

### macOS

The only platform where the iOS checks (`xcodebuild`, `pod`, `xcrun simctl`/`xctrace`) can
meaningfully pass. `CocoaPods` is only checked when targeting iOS on macOS specifically.

### Linux

Same as Windows for iOS (unsupported, clearly reported as such) — Android and web are fully
supported.

## What this deliberately doesn't do

- **Doesn't build/start the backend from source.** The backend lives in the sibling
  `patheya-express-platform` repo — see `infrastructure/docs/local-development-guide.md`. Local
  auto-start only runs the exact commands that guide documents, and only if that repo is actually
  present on disk.
- **Doesn't independently verify Postgres/Redis/BullMQ.** The backend's own `/api/v1/health`
  response already reports this; re-implementing those checks here would mean either duplicating
  credentials/connection logic this repo has no business holding, or faking it.
- **Doesn't wire up new native build configurations** (e.g. a QA-specific vs. staging-specific
  mobile build) — see the environment-selection note above.
- **Doesn't implement `--watch` for native** — see the Options table.

## "Partner" naming

The command is `partner:*`, but the underlying Nx project is `restaurant-app`. This matches the
naming already established in `docs/mobile/CAPACITOR.md`: the restaurant-facing app is the
"partner" app from a developer-command perspective, even though the project/folder/app-id all say
"restaurant". Nothing was renamed — this is purely an alias, declared once in `lib/registry.mjs`.

## Testing

```bash
node --test tools/launcher/test/
```

Plain `node:test` (built into Node 18+) — no Jest, no new test-runner dependency, since
`tools/launcher` isn't an Nx project and pulling in `@nx/jest` for one directory's tests would be
more machinery than the tests need. Every external process (`adb`, `git`, `docker`, `fetch`, ...)
is mocked; no real device, backend, or native toolchain is required to run the suite. See
`test/README.md` for what's covered.
