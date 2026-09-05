#!/usr/bin/env node
// Permanent, GitHub-versioned successor to the external Patheya-Express-Developer-Bootstrap-v5
// package. That package worked but lived outside any repository (a loose folder a developer had
// to be handed out-of-band) and duplicated its own logic twice — a full PowerShell implementation
// under windows/ and a full bash implementation under mac/ — which is exactly the kind of drift
// risk that produces bugs like the EADDRINUSE incident it was built to fix in the first place (one
// platform's script getting a fix the other didn't).
//
// This script is the single, cross-platform implementation: identical behavior on Windows/macOS/
// Linux via plain Node (`node tools/dev/bootstrap.mjs`), with only the genuinely OS-specific bit
// (launching the Docker Desktop GUI app) branching internally. It is deliberately a thin
// orchestrator, not a second implementation of anything the launcher already does correctly:
//   - Health parsing / duplicate-backend prevention -> tools/launcher/lib/detect-backend.mjs
//   - Tool checks (Node/pnpm/Nx/git/Docker)          -> tools/launcher/lib/validate-environment.mjs
//   - Output formatting                              -> tools/launcher/lib/log.mjs
//   - Process spawning (post-install)                -> tools/launcher/lib/exec.mjs
//   - Frontend app/platform selection & startup      -> tools/launcher/cli.mjs itself
// See tools/launcher/README.md's "Relationship to tools/dev/" section and DEVELOPMENT.md for the
// full responsibility model this fits into.
//
// IMPORTANT — module-loading order: this file's own top-level imports (below) and everything
// reachable from them must never resolve to a package under node_modules. `--setup` exists
// specifically to run on a fresh clone with node_modules absent entirely, so if this file's own
// `import` statements needed anything beyond Node's built-ins, the script that installs
// dependencies couldn't itself load without dependencies already being installed — that was this
// script's actual first bug (`cross-spawn`, pulled in transitively via tools/launcher/lib/exec.mjs
// and detect-backend.mjs, both true frontend dependencies). registry.mjs, log.mjs, and this
// directory's own lib/args.mjs and lib/env-file.mjs are all independently built-ins-only (verified
// by tools/dev/test/bootstrap.test.mjs's source-inspection test), so they're safe to import
// statically even before `pnpm install` has ever run. Everything that genuinely needs a real
// dependency (`exec.mjs`, `validate-environment.mjs`, `detect-backend.mjs` — via `cross-spawn`) is
// loaded with a dynamic `import()` *after* dependency installation is confirmed complete — see
// main()'s ordering below.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn as nodeSpawn } from 'node:child_process';
import * as log from '../launcher/lib/log.mjs';
import { repoRoot, resolveApp, resolveEnvironment, APPS } from '../launcher/lib/registry.mjs';
import { parseDevArgs } from './lib/args.mjs';
import { ensureEnvFile } from './lib/env-file.mjs';

// The backend is always a sibling checkout, never nested in this repo — same convention
// tools/launcher/lib/detect-backend.mjs uses for its own local-backend auto-start, kept in sync
// here rather than imported only because detect-backend.mjs doesn't currently export it as a
// constant; the join() itself is the single documented convention (see infrastructure/docs/
// local-development-guide.md), not a second guess at where the backend "might" be.
const BACKEND_REPO = join(repoRoot, '..', 'patheya-express-platform');
const BACKEND_ENV_EXAMPLE = join(BACKEND_REPO, 'apps', 'api-gateway', '.env.example');
const BACKEND_ENV_FILE = join(BACKEND_REPO, 'apps', 'api-gateway', '.env');
const DOCKER_ENGINE_TIMEOUT_MS = 90_000;
const DOCKER_ENGINE_POLL_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printUsage() {
  console.log(`
Usage: node tools/dev/bootstrap.mjs [app] [options]

  app   customer | partner | delivery | admin | none   (default: customer)
        "none" prepares the backend/dependencies only — no Angular app is started.

Options:
  --setup                First-time only: install frontend+backend dependencies, scaffold
                          apps/api-gateway/.env if missing, and run backend Prisma migrations.
  --backend-only          Start/verify infrastructure and exit; equivalent to "app=none".
  --skip-infrastructure   Never touch Docker; only validate tools and hand off to the app.
  --verbose               Full error output and DEBUG/TRACE logs.

Canonical commands (see DEVELOPMENT.md):
  pnpm run setup          First-time full-stack setup (this script, --setup, customer)
  pnpm run dev            Daily full-stack startup (this script, customer)
  pnpm run dev:backend-only   Infrastructure + backend health only, no frontend app
`);
}

/**
 * Runs a command with inherited stdio using ONLY `node:child_process` — deliberately not
 * `cross-spawn` — so this works before frontend node_modules exists (see this file's top-of-file
 * doc comment). `shell: true` is scoped to Windows only, where a PATH-resolved `pnpm` is a `.cmd`
 * shim that Windows's CreateProcess cannot execute directly without a shell interpreter (the
 * reason `cross-spawn` exists at all — see tools/launcher/lib/exec.mjs's own doc comment on
 * Node's DEP0190). That warning is about *array-of-args* escaping correctness through a shell;
 * every argument passed to this helper is a fixed literal this script wrote itself (never
 * user-supplied or dynamic), so the escaping pitfall shell:true normally carries doesn't apply
 * here. This helper is intentionally only ever used for the pre-install `pnpm install` calls —
 * everything after dependency installation uses the real `tools/launcher/lib/exec.mjs` (dynamically
 * imported), not this one.
 */
function spawnInheritRaw(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = nodeSpawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', (error) => resolve({ code: null, error }));
    child.on('close', (code) => resolve({ code, error: null }));
  });
}

/** Same built-ins-only constraint as spawnInheritRaw, but captures stdout instead of inheriting
 *  it — used only for the informational `pnpm --version` check below. Never throws; resolves to
 *  `null` on any failure (missing binary, non-zero exit) since this is purely diagnostic. */
function captureRaw(command, args) {
  return new Promise((resolve) => {
    const child = nodeSpawn(command, args, { stdio: ['ignore', 'pipe', 'ignore'], shell: process.platform === 'win32' });
    let out = '';
    child.stdout?.on('data', (chunk) => (out += chunk));
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve(code === 0 ? out.trim() : null));
  });
}

/** First-time only (--setup). Installs each repo's own dependencies with its own package manager
 *  invocation in its own directory — this script never inspects or second-guesses *how* either
 *  repo installs its dependencies, only that `pnpm install` is each one's documented entry point.
 *  Uses spawnInheritRaw (node:child_process only) rather than tools/launcher/lib/exec.mjs, because
 *  this is the one step that must work before node_modules — and therefore cross-spawn — exists. */
async function installDependenciesRaw({ backendPresent }) {
  log.section('Step 0 — Installing dependencies');

  log.info('Frontend (pnpm install)…');
  const frontend = await spawnInheritRaw('pnpm', ['install'], { cwd: repoRoot });
  if (frontend.error?.code === 'ENOENT') {
    return { ok: false, rootCause: 'pnpm not found on PATH.', suggestedFix: 'Install pnpm: https://pnpm.io/installation (e.g. `npm install -g pnpm@11.5.3`).' };
  }
  if (frontend.code !== 0) {
    return { ok: false, rootCause: 'Frontend `pnpm install` failed.', suggestedFix: 'See the pnpm output above for the underlying error.' };
  }
  log.ok('Frontend dependencies installed.');

  if (backendPresent) {
    log.info('Backend (pnpm install)…');
    const backend = await spawnInheritRaw('pnpm', ['install'], { cwd: BACKEND_REPO });
    if (backend.error?.code === 'ENOENT') {
      return { ok: false, rootCause: 'pnpm not found on PATH.', suggestedFix: 'Install pnpm: https://pnpm.io/installation (e.g. `npm install -g pnpm@11.5.3`).' };
    }
    if (backend.code !== 0) {
      return { ok: false, rootCause: 'Backend `pnpm install` failed.', suggestedFix: 'See the pnpm output above for the underlying error.' };
    }
    log.ok('Backend dependencies installed.');
  }

  return { ok: true };
}

/**
 * Informational only — never blocks. Frontend and backend intentionally pin different pnpm
 * versions (11.5.3 / 11.4.0 at time of writing): each repo runs its own `pnpm install` in its own
 * directory, so this script never forces one repo's pin onto the other (see DEVELOPMENT.md's
 * "pnpm version policy" for why no single canonical version is enforced, and why Corepack isn't
 * used to enforce one — it reintroduces the Windows EPERM issue Bootstrap v5 hit under
 * `C:\Program Files\nodejs`). This just surfaces all three numbers so a real mismatch is visible
 * instead of silently discovered later as a confusing install/lockfile error.
 */
async function reportPnpmVersions({ backendPresent }) {
  const installed = await captureRaw('pnpm', ['--version']);
  let frontendExpected = null;
  try {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
    frontendExpected = /^pnpm@([\d.]+)/.exec(pkg.packageManager ?? '')?.[1] ?? null;
  } catch {
    // Best-effort — frontend/package.json always exists in practice; malformed JSON there would
    // already have failed `pnpm install` above.
  }

  log.section('pnpm version check');
  log.detail(`Installed: ${installed ?? 'unknown'}`);
  log.detail(`Frontend pins: ${frontendExpected ?? 'unspecified'} (frontend/package.json)`);

  if (!backendPresent) {
    return;
  }
  let backendExpected = null;
  try {
    const backendPkg = JSON.parse(readFileSync(join(BACKEND_REPO, 'package.json'), 'utf8'));
    backendExpected = backendPkg.devEngines?.packageManager?.version ?? null;
  } catch {
    // Best-effort — same reasoning as above.
  }
  log.detail(`Backend pins: ${backendExpected ?? 'unspecified'} (patheya-express-platform/package.json)`);

  if (frontendExpected && backendExpected && frontendExpected !== backendExpected) {
    log.warn(
      `Frontend (${frontendExpected}) and backend (${backendExpected}) pin different pnpm versions — intentional, not a bug (see DEVELOPMENT.md). Each repo installs independently; this is only worth investigating if \`pnpm install\` itself reported a problem above.`,
    );
  }
}

/** Docker Desktop's GUI process, not just the Docker CLI/engine — Bootstrap v5's own lesson
 *  (README.md: "Docker Desktop is started/waited for on Windows") was that the CLI can be on PATH
 *  while the engine itself isn't running yet, and a developer shouldn't have to know to go start
 *  the app by hand. Linux intentionally isn't auto-started here: it's normally a systemd-managed
 *  daemon (`dockerd`), starting which needs privileges this script has no business assuming or
 *  requesting non-interactively — see docs/infrastructure/docker.md for why that's out of scope.
 *  Runs after dependency installation, via the dynamically-imported runCapture (real cross-spawn),
 *  purely for consistency with every other spawn in this script from this point on — Docker's own
 *  CLI has no .cmd-shim resolution problem either way. */
async function ensureDockerEngineRunning(runCapture) {
  const initial = await runCapture('docker', ['info']);
  if (initial.code === 0) {
    log.ok('Docker engine is running.');
    return true;
  }
  if (initial.error?.code === 'ENOENT') {
    log.fail('Docker CLI not found on PATH.');
    log.detail('Install Docker Desktop: https://docs.docker.com/get-docker/');
    return false;
  }

  log.warn('Docker CLI found, but the engine is not running yet.');

  if (process.platform === 'win32') {
    const candidates = ['C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe', join(process.env['LOCALAPPDATA'] ?? '', 'Docker', 'Docker Desktop.exe')];
    const dockerDesktop = candidates.find((path) => existsSync(path));
    if (!dockerDesktop) {
      log.fail('Docker Desktop was not found at either usual Windows install location.');
      log.detail('Install it: https://docs.docker.com/desktop/setup/install/windows-install/');
      return false;
    }
    log.info('Starting Docker Desktop…');
    nodeSpawn(dockerDesktop, [], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'darwin') {
    log.info('Starting Docker Desktop…');
    await runCapture('open', ['-a', 'Docker']);
  } else {
    log.fail('Docker engine is not running, and this script does not start it automatically on Linux.');
    log.detail('Start it yourself, e.g. `sudo systemctl start docker`, then re-run.');
    return false;
  }

  log.detail(`Waiting up to ${DOCKER_ENGINE_TIMEOUT_MS / 1000}s for the engine to become ready…`);
  const deadline = Date.now() + DOCKER_ENGINE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(DOCKER_ENGINE_POLL_MS);
    const check = await runCapture('docker', ['info']);
    if (check.code === 0) {
      log.ok('Docker engine is ready.');
      return true;
    }
  }
  log.fail(`Docker engine did not become ready within ${DOCKER_ENGINE_TIMEOUT_MS / 1000}s.`);
  return false;
}

function ensureBackendEnvFile() {
  const status = ensureEnvFile(BACKEND_ENV_EXAMPLE, BACKEND_ENV_FILE);
  if (status === 'example-missing') {
    log.warn('Backend apps/api-gateway/.env.example not found — skipping .env scaffold.');
  } else if (status === 'already-exists') {
    log.ok('Backend apps/api-gateway/.env already exists (left untouched).');
  } else {
    log.ok('Created backend apps/api-gateway/.env from .env.example.');
    log.detail('Default values match docker-compose.yml (Postgres/Redis/Kafka on localhost). Fill in Razorpay/SMTP/Cloudinary only if you need those flows locally.');
  }
}

/** First-time only (--setup), and only after the backend is confirmed healthy — i.e. Postgres is
 *  definitely reachable at localhost:5432. Deliberately best-effort/non-fatal: the containerized
 *  api-gateway's own health check is a raw `SELECT 1`, which succeeds against an unmigrated
 *  database just as well as a migrated one (see backend repo's health.service.ts), so a fresh clone
 *  reports "healthy" while every real query would still fail without this step — but a migration
 *  failure here (e.g. a developer's own schema drift) shouldn't block getting the dev server up;
 *  it should just tell them clearly what to fix. Bootstrap v5's own README is explicit that this
 *  must never run as part of *daily* startup ("Do not automatically run migrations or seeds during
 *  daily startup") — only --setup reaches this function.
 *
 *  Runs `prisma migrate dev` (via the backend's own `db:migrate` script) — deliberately never
 *  `migrate reset` or `db push`, which can drop/desync data. This is the same command the backend
 *  repo's own README documents for local setup, not a new migration strategy invented here. `pnpm
 *  --filter api-gateway run db:migrate` runs with stdio inherited (not captured), so if Prisma
 *  itself detects schema drift and prompts for confirmation before doing anything destructive, that
 *  prompt reaches the real developer's terminal — this script never answers it automatically or
 *  suppresses it. */
async function runBackendMigrations(runInherit) {
  log.section('Backend database migrations');
  log.detail('Running `prisma migrate dev` — if Prisma detects schema drift, it may ask for interactive confirmation below before changing anything destructive; answer it yourself, nothing here auto-confirms it.');
  const result = await runInherit('pnpm', ['--filter', 'api-gateway', 'run', 'db:migrate'], { cwd: BACKEND_REPO });
  if (result.code !== 0) {
    log.warn('Backend database migration did not complete successfully.');
    log.detail(`Run it manually once fixed: pnpm --filter api-gateway run db:migrate  (from ${BACKEND_REPO})`);
    return;
  }
  log.ok('Backend database is up to date.');
}

async function main() {
  const args = parseDevArgs(process.argv.slice(2));
  log.setVerbose(args.verbose);

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  console.log(`\nPatheya Express Developer Setup\n${'─'.repeat(50)}`);
  log.detail(`Workspace: ${join(repoRoot, '..')}`);

  const wantsFrontend = !args.backendOnly && args.appAlias !== 'none';
  let app = null;
  if (wantsFrontend) {
    try {
      app = resolveApp(args.appAlias);
    } catch {
      log.failWithGuidance({
        rootCause: `Unknown app "${args.appAlias}".`,
        suggestedFix: `Use one of: ${Object.keys(APPS).join(', ')}, none.`,
      });
      process.exitCode = 1;
      return;
    }
  }

  const backendPresent = existsSync(BACKEND_REPO);
  if (!args.skipInfrastructure && !backendPresent) {
    log.failWithGuidance({
      rootCause: `Backend repository not found at ${BACKEND_REPO}.`,
      suggestedFix: 'Clone patheya-express-platform as a sibling of this repo: git clone <backend-repo-url> ../patheya-express-platform',
      nextAction: 'Or pass --skip-infrastructure if you intend to point at a remote backend instead (use the launcher\'s own --env flag for that).',
    });
    process.exitCode = 1;
    return;
  }

  // --- Everything above this line is safe to run with zero node_modules anywhere. ---

  if (args.setup) {
    const installResult = await installDependenciesRaw({ backendPresent });
    if (!installResult.ok) {
      log.failWithGuidance(installResult);
      process.exitCode = 1;
      return;
    }
  }

  // --- From here on, frontend node_modules is guaranteed to exist (pre-existing, or just
  // installed above) — safe to load the real dependency-backed launcher modules. This is the one
  // and only place in this file a dependency-backed module is loaded, and it happens exactly once. ---
  const { runCapture, runInherit } = await import('../launcher/lib/exec.mjs');
  const { buildToolChecks, runChecks } = await import('../launcher/lib/validate-environment.mjs');
  const { detectBackend } = await import('../launcher/lib/detect-backend.mjs');

  if (args.setup) {
    await reportPnpmVersions({ backendPresent });
  }

  log.section('Step 1 — Tool validation');
  // 'web' scope: mobile-only tools (Java/Android SDK/Xcode) are the launcher's own concern when a
  // developer actually runs `pnpm <app>:android`/`:ios` — this script's job is getting the backend
  // and a web dev loop running, not gatekeeping tooling nobody asked for yet (see DEVELOPMENT.md's
  // "Required for web" vs "Required only for mobile" split). This check's own "Dependencies
  // installed (node_modules)" item is exactly why it must run *after* the --setup install step
  // above, not before it — running it first would fail this exact check on every fresh clone,
  // before --setup ever got a chance to fix it.
  const toolResult = await runChecks(buildToolChecks({ platform: 'web' }));
  if (!toolResult.ok) {
    log.failWithGuidance({
      rootCause: `Tool validation failed (${toolResult.failed.length} problem${toolResult.failed.length === 1 ? '' : 's'}).`,
      suggestedFix: 'Fix the ✖ items above and re-run.',
    });
    process.exitCode = 1;
    return;
  }

  if (args.setup && backendPresent) {
    ensureBackendEnvFile();
  }

  if (!args.skipInfrastructure) {
    log.section('Step 2 — Local infrastructure (Docker Compose)');
    const engineReady = await ensureDockerEngineRunning(runCapture);
    if (!engineReady) {
      process.exitCode = 1;
      return;
    }

    // Any app resolves the same shared local API base URL — see doctor.mjs's identical reasoning.
    // detectBackend() already contains every rule this task requires: it runs `docker compose up
    // -d` (which starts api-gateway itself — see docker-compose.yml) and NEVER also spawns a host
    // `pnpm --filter api-gateway start:dev`, so there is exactly one process on :3000 either way.
    const probeApp = app ?? resolveApp('customer');
    const environment = resolveEnvironment('local');
    const backendResult = await detectBackend({
      app: probeApp,
      environment,
      envName: 'local',
      verbose: args.verbose,
      noBackendStart: false,
      sectionTitle: 'Step 3 — Backend health',
    });

    if (!backendResult.ok) {
      log.failWithGuidance({ ...backendResult, verbose: args.verbose });
      process.exitCode = 1;
      return;
    }

    if (args.setup && backendPresent) {
      await runBackendMigrations(runInherit);
    }
  } else {
    log.info('Infrastructure startup skipped (--skip-infrastructure).');
  }

  if (!wantsFrontend) {
    log.printDashboard({
      title: 'Patheya Express Developer Setup',
      rows: [['Backend/infrastructure', 'Ready']],
      footer: 'Frontend launch skipped (--backend-only / app=none).',
    });
    return;
  }

  log.section('Step 4 — Frontend');
  log.ok(`Starting ${app.displayName}…`);
  const launch = await runInherit('node', ['tools/launcher/cli.mjs', app.alias, 'web'], { cwd: repoRoot });
  process.exitCode = launch.code === 0 || launch.code === null ? 0 : 1;
}

main().catch((error) => {
  log.failWithGuidance({
    rootCause: 'The developer setup script hit an unexpected internal error.',
    suggestedFix: 'Re-run with --verbose for the full error.',
    error,
    verbose: process.argv.includes('--verbose'),
  });
  process.exitCode = 1;
});
