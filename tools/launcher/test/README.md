# Launcher tests

```bash
pnpm test:launcher
# or: node --test tools/launcher/test/*.test.mjs
```

Plain `node:test` (built into Node 18+) — no Jest, since `tools/launcher` isn't an Nx project.
94 tests, all passing, no real device/backend/native toolchain required.

## Approach: real behavior over mocks

Rather than mocking `child_process`/`fetch` (which would mean asserting the mock was called
correctly, not that the code actually works), most of these tests exercise real code paths against
either pure functions or small, deterministic real infrastructure:

- **Pure functions** (`registry.mjs`, `devices.mjs`'s parsers, `pipeline.mjs`, `args.mjs`,
  `log.mjs`'s formatting/dashboard rendering) are tested directly with real inputs — no I/O to
  fake at all.
- **`exec.mjs`** is tested against the real Node binary running this test (`process.execPath`) as
  a stand-in "external command" — guaranteed present in every environment the suite runs in,
  exercises the real `cross-spawn` code path.
- **`detect-backend.mjs`'s `checkHealth`** is tested against a real `node:http` server on an
  OS-assigned free port — deterministic, no network access, exercises the actual `fetch` call
  rather than a stand-in for it.
- **`cli.mjs` and `doctor.mjs`** are tested by spawning the real script as a child process
  (integration-style) for the paths that don't require a real device/backend: argument validation,
  guard rails, and doctor's full diagnostic sweep (which is designed to degrade gracefully when
  tools/devices aren't present — that's exactly what it's for).

## What's deliberately not covered

- **`detectBackend()`'s `local`-environment branch end-to-end** (as opposed to `checkHealth`,
  which is fully covered): it always resolves to the hardcoded `http://localhost:3000` — what's
  listening there (if anything) varies by machine, so asserting reachable-vs-not would be flaky
  across environments, including in CI.
- **The sibling-repo auto-start path** (`docker compose up -d` + `pnpm --filter api-gateway
  start:dev` in `../patheya-express-platform`): inherently requires that repo to exist and Docker
  to be running; not something a fast unit suite should depend on.
- **Real Android/iOS device interaction** (`cap run`, `adb`/`xcrun` actually talking to hardware):
  the parsing logic these depend on (`parseAdbDevicesOutput`, `parseSimctlOutput`,
  `parseXctraceOutput`) is fully covered with realistic sample output; the actual device
  communication is Capacitor's own, not this launcher's, code.
- **`nx build`/`nx serve`/`cap sync` themselves** — `verify-build.mjs`/`sync-native.mjs` delegate
  to Nx/Capacitor, which have their own test coverage upstream; what this suite covers instead is
  the change-detection/caching logic *around* those calls (implicitly, via the pipeline tests) and
  Task 4's parallel-execution/output-ordering guarantees, which are this launcher's own logic.

## File map

| Test file | Covers |
|---|---|
| `args.test.mjs` | Argument parsing (Task 13: "Argument parsing") |
| `registry.test.mjs` | App/environment/profile resolution, env-file reading (Task 13: "Registry", "Profile resolution") |
| `devices.test.mjs` | `adb`/`simctl`/`xctrace` output parsing, profile filtering |
| `pipeline.test.mjs` | Stage sequencing, parallel groups, halt-on-failure, output ordering (Task 13: "Pipeline execution") |
| `log.test.mjs` | Duration formatting, verbose gating, error formatting, output capture, dashboard rendering (Task 13: "Logging", "Error formatting") |
| `validate-environment.test.mjs` | Check aggregation/severity rules, concurrency (Task 13: "Environment validation") |
| `detect-backend.test.mjs` | Health-check response handling (Task 13: "Backend detection") |
| `exec.test.mjs` | Process spawning primitives |
| `cli.test.mjs` | CLI guard rails (unknown app/platform/env/profile, unsupported platform) |
| `doctor.test.mjs` | Doctor command runs to completion and reports every section (Task 13: "Doctor command") |
