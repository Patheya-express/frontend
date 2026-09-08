import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as log from './log.mjs';
import { resolveApiBaseUrl, repoRoot } from './registry.mjs';
import { runCapture } from './exec.mjs';
// tools/dev/lib/env-file.mjs is a dependency-free leaf module (see its own file for why) — reused
// here rather than re-implemented because this function, not tools/dev/bootstrap.mjs, is the one
// and only place that actually invokes `docker compose up` (see startSiblingBackend() below). A
// developer who never runs `pnpm run setup` at all — just `pnpm customer:web` straight after
// cloning — must get the same "a real, non-placeholder infrastructure/docker/.env.compose exists"
// guarantee bootstrap.mjs provides, or the api-gateway container crash-loops on the exact
// placeholder-JWT-secret failure this module's own health check would otherwise just report as a
// generic timeout.
import { ensureEnvFile, ensureLocalSecrets } from '../../dev/lib/env-file.mjs';

const HEALTH_PATH = '/api/v1/health';
const HEALTH_TIMEOUT_MS = 4000;
const START_POLL_TIMEOUT_MS = 60_000;
const START_POLL_INTERVAL_MS = 2000;

// The backend lives in a sibling repo (patheya-express-platform), never in this one — see
// infrastructure/docs/local-development-guide.md. Auto-start is only attempted when that sibling
// directory is actually present next to this checkout; this repo has no way to know if it exists
// anywhere else, and guessing a path would be worse than just telling the developer what to run.
const SIBLING_BACKEND_REPO = join(repoRoot, '..', 'patheya-express-platform');

const COMPOSE_FILE_REL = 'infrastructure/docker/docker-compose.yml';
const COMPOSE_ENV_FILE_REL = 'infrastructure/docker/.env.compose';
const COMPOSE_ENV_EXAMPLE = join(SIBLING_BACKEND_REPO, 'infrastructure', 'docker', '.env.compose.example');
const COMPOSE_ENV_FILE = join(SIBLING_BACKEND_REPO, 'infrastructure', 'docker', COMPOSE_ENV_FILE_REL.split('/').pop());
const COMPOSE_SECRET_KEYS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
// Fixed by docker-compose.yml's `container_name:` — safe to address directly with plain `docker
// inspect`/`docker logs` (not `docker compose ...`) regardless of this process's cwd or whether a
// Compose project context is available, which matters for the crash-loop diagnostics below.
const API_GATEWAY_CONTAINER = 'patheya-express-api-gateway';

/**
 * Hits the real backend health endpoint (GET /api/v1/health). Every response from the API gateway
 * — this endpoint included — is wrapped in a `{success, timestamp, data}` envelope by its global
 * ResponseInterceptor (apps/api-gateway/src/core/interceptors/response.interceptor.ts in the
 * sibling repo), so the actual HealthResponseDto fields (status/database/redis/queues/websocket —
 * see libs/shared/api-sdk's HealthResponseDto) live under `data`, not at the top level. This
 * reflects the backend's own view of its subsystems rather than the launcher independently
 * reimplementing Postgres/Redis/BullMQ connectivity checks it has no credentials to perform.
 *
 * Only `status`/`database`/`redis`/`websocket` are treated as guaranteed — `queues` (BullMQ) is
 * read if present but never required or fabricated, since the DTO has changed shape over time
 * (e.g. it isn't emitted by every backend build) and a launcher check has no business asserting a
 * contract the backend itself doesn't currently honor.
 */
export async function checkHealth(apiBaseUrl) {
  let response;
  try {
    response = await fetch(new URL(HEALTH_PATH, apiBaseUrl), { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
  } catch {
    return { reachable: false, healthy: false, malformed: false, statusCode: null, data: null };
  }

  if (!response.ok) {
    return { reachable: true, healthy: false, malformed: false, statusCode: response.status, data: null };
  }

  let body;
  try {
    body = await response.json();
  } catch {
    return { reachable: true, healthy: false, malformed: true, statusCode: response.status, data: null };
  }

  const data = body && typeof body === 'object' && body.success === true && body.data && typeof body.data === 'object' ? body.data : null;

  if (!data || typeof data.status !== 'string') {
    return { reachable: true, healthy: false, malformed: true, statusCode: response.status, data: null };
  }

  return { reachable: true, healthy: data.status === 'ok', malformed: false, statusCode: response.status, data };
}

/** Prints only the subsystem fields the response actually included — never invents a field the
 *  backend didn't send (an older/newer backend build's DTO shape shouldn't produce a fabricated
 *  "undefined" row). */
function reportHealthData(data) {
  const subsystem = (label, value, healthyValue) => {
    if (value === undefined) {
      return;
    }
    if (value === healthyValue) {
      log.ok(`${label}: ${value}`);
    } else {
      log.warn(`${label}: ${value}`);
    }
  };

  subsystem('Database', data.database, 'connected');
  subsystem('Redis', data.redis, 'connected');
  if (data.queues !== undefined) {
    subsystem('BullMQ queues', data.queues, 'connected');
  }
  if (data.websocket !== undefined && data.websocket !== 'not_applicable') {
    subsystem('Socket.IO', data.websocket, 'ready');
  }
}

/** Best-effort, Windows-only: parses `netstat -ano` for the PID listening on `port`, then
 *  `tasklist` for that PID's process name. Cross-platform process-owner lookup would need a
 *  different real command per OS (`lsof`/`ss` on Linux, `lsof` on macOS, neither guaranteed
 *  present) for a diagnostic-only nice-to-have — not worth the added surface here, and explicitly
 *  documented as a known limitation in DEVELOPMENT.md rather than silently pretending to cover
 *  every platform. Never throws; returns null on any failure so callers can fall back to a generic
 *  message. */
async function findPortOwnerWindows(port) {
  const netstat = await runCapture('netstat', ['-ano']);
  if (netstat.code !== 0) {
    return null;
  }
  const line = netstat.stdout.split('\n').find((l) => l.includes(`:${port} `) && /LISTENING/i.test(l));
  if (!line) {
    return null;
  }
  const pid = line.trim().split(/\s+/).pop();
  if (!pid || Number.isNaN(Number(pid))) {
    return null;
  }
  const tasklist = await runCapture('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']);
  if (tasklist.code !== 0) {
    return null;
  }
  const name = tasklist.stdout.split(',')[0]?.replace(/"/g, '').trim();
  return name ? `${name} (PID ${pid})` : `PID ${pid}`;
}

/** Used only when a response was reachable but didn't match the expected health contract — i.e.
 *  *something* is listening and answering HTTP on this port, just not our API. Scoped to `local`
 *  (checking a remote environment's port ownership on this machine would be meaningless). */
export async function describeUnexpectedOccupant(apiBaseUrl) {
  if (process.platform !== 'win32') {
    return 'The process currently using this port could not be identified automatically on this platform.';
  }
  let port;
  try {
    port = new URL(apiBaseUrl).port || '80';
  } catch {
    return 'The process currently using this port could not be identified automatically.';
  }
  const owner = await findPortOwnerWindows(port).catch(() => null);
  return owner ? `Port ${port} is occupied by: ${owner}.` : `Port ${port} appears occupied, but the owning process could not be identified automatically.`;
}

/** Ensures infrastructure/docker/.env.compose exists and holds real (non-placeholder) JWT secrets
 *  before `docker compose up` ever runs — see this file's top-of-file doc comment on the import for
 *  why this lives here rather than only in tools/dev/bootstrap.mjs. Returns the same status
 *  ensureEnvFile() does ('created' / 'already-exists' / 'example-missing') purely for logging; the
 *  secret-generation step itself is a no-op (not even a write) once the file already holds valid
 *  secrets, so calling this on every single backend auto-start is cheap. */
function ensureComposeEnvFile() {
  const status = ensureEnvFile(COMPOSE_ENV_EXAMPLE, COMPOSE_ENV_FILE);
  if (status !== 'example-missing') {
    ensureLocalSecrets(COMPOSE_ENV_FILE, COMPOSE_SECRET_KEYS);
  }
  return status;
}

/** Masks the value of any of COMPOSE_SECRET_KEYS inside arbitrary text — a defensive backstop for
 *  diagnostic surfaces that pass through *external* tool output (Docker Compose's own stderr, a
 *  container's boot log) this code doesn't otherwise control. In practice neither currently has
 *  anything to redact: Compose's own "couldn't find env file" error is a bare path, and the
 *  backend's placeholder-rejection message (env.validation.ts) names the field, never the value —
 *  but a hand-edited/corrupted `.env.compose` could in principle make Compose's own parser echo a
 *  raw line back, so every diagnostic string in this file is still passed through this first. */
export function redactSecrets(text) {
  let redacted = text;
  for (const key of COMPOSE_SECRET_KEYS) {
    redacted = redacted.replace(new RegExp(`(${key}\\s*=)\\S+`, 'g'), '$1[redacted]');
  }
  return redacted;
}

/** Keeps only the last `maxLines` lines of `text` — the same "enough to act on, not a full dump"
 *  cap collectApiGatewayDiagnostics() applies via `docker logs --tail`, applied here client-side
 *  since Docker Compose's own CLI has no equivalent flag for its own stderr/stdout. */
function truncateTail(text, maxLines) {
  const lines = text.split('\n');
  return lines.length > maxLines ? lines.slice(-maxLines).join('\n') : text;
}

/** True for the exact stderr Docker Compose prints when `--env-file` points at a path that doesn't
 *  exist (verified directly: `couldn't find env file: <path>`, exit code 1) — lets the failure
 *  message name this specific, actionable cause instead of a generic "compose failed". */
export function isMissingEnvFileError(composeUp) {
  return /couldn't find env file/i.test(composeUp.stderr ?? '');
}

/** Renders a failed `docker compose up`'s captured output into the single multi-line string
 *  log.failWithGuidance's `diagnostics` field expects — `null` when there's genuinely nothing to
 *  show (e.g. the `docker` binary itself doesn't exist, so there's no output at all). */
export function formatComposeFailureDiagnostics(composeUp) {
  const output = [composeUp.stderr, composeUp.stdout].filter(Boolean).join('\n').trim();
  if (!output) {
    return null;
  }
  return redactSecrets(truncateTail(output, 40));
}

/**
 * Pure argv builder for the one `docker compose up` this launcher ever runs — split out from
 * startSiblingBackend() purely so the THIRD FRESH-MACHINE FAILURE's actual fix (an explicit
 * `--env-file` pointing at `.env.compose`, never the `.env.compose.example` template, and never
 * relying on Compose's own same-directory `.env` auto-discovery) is a plain data assertion in a
 * test, not something only exercisable by mocking `cross-spawn`.
 */
export function buildComposeUpArgs() {
  return ['compose', '--env-file', COMPOSE_ENV_FILE_REL, '-f', COMPOSE_FILE_REL, 'up', '-d'];
}

/**
 * Starts the local backend stack via `docker compose up -d` and reports whether that command
 * itself actually succeeded — distinct from, and checked before, whether the backend then becomes
 * *healthy* (detectBackend()'s own poll loop, right after this returns). Compose can fail
 * immediately and non-interactively (a missing `--env-file` target, Docker Desktop not running, a
 * build error) with zero containers ever created; previously this function never inspected the
 * command's exit code at all, so a hard Compose failure was still followed by "Started `docker
 * compose up -d`..." and a full health-poll wait for a backend that was never even attempted.
 *
 * Returns `{ok: true}` on success (callers proceed to the health poll) or `{ok: false, ...}` with
 * the same rootCause/suggestedFix/diagnostics shape every other failure in this module uses — the
 * caller returns this directly instead of polling, so a Compose failure is reported in well under
 * a second instead of after the full START_POLL_TIMEOUT_MS.
 */
async function startSiblingBackend({ verbose }) {
  log.info('Local backend not reachable — attempting to start it from the sibling repo.');
  log.detail(SIBLING_BACKEND_REPO);

  const envStatus = ensureComposeEnvFile();
  if (envStatus === 'example-missing') {
    log.warn(`${COMPOSE_ENV_FILE_REL}.example not found — starting Docker Compose with its built-in placeholder defaults only (this will likely fail Nest's config validation).`);
  } else if (envStatus === 'created') {
    log.info(`Created ${COMPOSE_ENV_FILE_REL} with freshly generated local JWT secrets (values never printed).`);
  }

  // `docker compose up -d` (no service filter) starts the whole stack, api-gateway included —
  // see the sibling repo's infrastructure/docker/docker-compose.yml, whose `api-gateway` service
  // has no `profiles:` restriction and publishes :3000 itself. Deliberately NOT also spawning
  // `pnpm --filter api-gateway start:dev` here: that was this launcher's own past bug — it raced
  // the containerized api-gateway for the same port and produced EADDRINUSE the moment the
  // container won the race. If a developer intentionally runs api-gateway on the host instead of
  // in a container, they exclude it from Compose themselves (`docker compose up postgres redis
  // kafka zookeeper` — see infrastructure/docs/local-development-guide.md) and pass
  // --no-backend-start so this launcher doesn't fight that setup.
  //
  // Captured (via runCapture, not streamed) rather than inherited even under --verbose: the exit
  // code and output must be inspected regardless of verbosity, and there is exactly one place left
  // that still echoes it back for a `--verbose` run (log.trace below) — a minor loss of real-time
  // streaming for this one command, in exchange for never again reporting success in the face of a
  // failed command.
  const composeUp = await runCapture('docker', buildComposeUpArgs(), { cwd: SIBLING_BACKEND_REPO });

  if (verbose && (composeUp.stdout || composeUp.stderr)) {
    log.trace(`docker compose up -d output:\n${redactSecrets(composeUp.stdout + composeUp.stderr)}`);
  }

  if (composeUp.error?.code === 'ENOENT') {
    return {
      ok: false,
      rootCause: 'Docker CLI not found on PATH.',
      suggestedFix: 'Install Docker Desktop: https://docs.docker.com/get-docker/',
    };
  }

  if (composeUp.code !== 0) {
    const missingEnvFile = envStatus === 'example-missing' || isMissingEnvFileError(composeUp);
    return {
      ok: false,
      rootCause: missingEnvFile
        ? `Docker Compose startup failed because ${COMPOSE_ENV_FILE_REL} does not exist.`
        : `Docker Compose failed to start the local backend stack (\`docker compose up -d\` exited with code ${composeUp.code}).`,
      suggestedFix: missingEnvFile
        ? `Confirm the backend checkout is complete (${COMPOSE_ENV_FILE_REL}.example should exist) and re-run — this normally scaffolds itself automatically.`
        : `Run it yourself to see the full error: docker compose --env-file ${COMPOSE_ENV_FILE_REL} -f ${COMPOSE_FILE_REL} up -d  (from ${SIBLING_BACKEND_REPO})`,
      diagnostics: formatComposeFailureDiagnostics(composeUp),
    };
  }

  log.info('Started `docker compose up -d` (postgres, redis, kafka, zookeeper, api-gateway).');
  log.detail('Waiting for the health endpoint to report healthy…');
  return { ok: true };
}

/**
 * Best-effort container diagnostics for the one case a bare "did not become healthy within Ns"
 * message isn't enough to act on: the api-gateway container itself crash-looping (rejected config,
 * a code error at boot, etc.) rather than merely being slow to start. Deliberately loose/best-effort
 * — `docker inspect`/`docker logs` failing here (Docker CLI missing, container never created at
 * all) must never throw or block the real failure message from reaching the developer, so every
 * field is nullable and both callers already handle that. Log output is capped at the last 40
 * lines so a chatty boot sequence can't flood the terminal — enough to act on, not a full dump (see
 * DEVELOPMENT.md's "no thousands of lines of logs" requirement).
 */
async function collectApiGatewayDiagnostics() {
  const status = await runCapture('docker', ['inspect', '--format', '{{.State.Status}}', API_GATEWAY_CONTAINER]);
  const logs = await runCapture('docker', ['logs', '--tail', '40', API_GATEWAY_CONTAINER]);
  const containerStatus = status.code === 0 ? status.stdout.trim() : null;
  const rawLogs = (logs.stdout || logs.stderr || '').trim();
  return { containerStatus, recentLogs: rawLogs ? redactSecrets(rawLogs) : null };
}

/** Renders collectApiGatewayDiagnostics()'s result as the single multi-line string
 *  log.failWithGuidance's `diagnostics` field expects — `null` when there's nothing to show (e.g.
 *  the container was never created, or Docker itself isn't reachable), so callers can pass the
 *  result straight through without an extra presence check. */
export function formatDiagnosticsBlock({ containerStatus, recentLogs } = {}) {
  const lines = [];
  if (containerStatus) {
    lines.push(`api-gateway container status: ${containerStatus}`);
  }
  if (recentLogs) {
    lines.push('Recent api-gateway log output (last 40 lines):', recentLogs);
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Step 2 — backend detection. For `local`, tries the health endpoint; if unreachable and the
 * sibling backend repo is present on disk, attempts to start it (see startSiblingBackend) and
 * polls until healthy or a timeout. For remote environments (qa/staging/production), only ever
 * validates connectivity — never attempts to start anything.
 */
export async function detectBackend({ app, environment, envName, verbose, noBackendStart, sectionTitle = 'Step 2 — Backend detection' }) {
  log.section(sectionTitle);

  const apiBaseUrl = resolveApiBaseUrl(app.project, envName);
  if (!apiBaseUrl) {
    return {
      ok: false,
      rootCause: `Could not determine the API base URL for ${app.displayName} in the "${envName}" environment.`,
      suggestedFix: `Check apps/${app.project}/src/environments/environment.${envName === 'local' ? '' : envName}.ts.`,
    };
  }

  log.detail(`Target: ${apiBaseUrl}${HEALTH_PATH} (${environment.label})`);

  let result = await checkHealth(apiBaseUrl);

  if (result.reachable && result.healthy) {
    log.ok(`Backend healthy at ${apiBaseUrl}`);
    reportHealthData(result.data);
    return { ok: true, apiBaseUrl, data: result.data };
  }

  if (result.reachable && result.malformed) {
    log.warn(`Backend reachable but returned an invalid health response at ${apiBaseUrl}`);
    // Reachable-but-wrong-contract most often means something *other* than api-gateway is holding
    // this port (an old native process, another project) rather than an actual backend regression
    // — surface what's occupying it when we can, only for `local` (identifying a port owner on
    // this machine is meaningless for a remote environment).
    const occupantNote = !environment.isRemote ? ` ${await describeUnexpectedOccupant(apiBaseUrl)}` : '';
    return {
      ok: false,
      rootCause: `Backend at ${apiBaseUrl} responded to ${HEALTH_PATH}, but the body didn't match the expected {success, data: {status, ...}} contract.${occupantNote}`,
      suggestedFix: 'Confirm this frontend checkout and the running backend are on compatible versions — the health response contract may have changed.',
      nextAction: `Inspect the raw response: curl ${apiBaseUrl}${HEALTH_PATH}`,
      retryHint: 'Re-run once the backend is serving a recognizable health response.',
    };
  }

  if (result.reachable && !result.healthy) {
    log.warn(`Backend reachable but reporting degraded status at ${apiBaseUrl}`);
    if (result.data) {
      reportHealthData(result.data);
    }
    return {
      ok: false,
      rootCause: `Backend at ${apiBaseUrl} is up but degraded (see subsystem status above).`,
      suggestedFix: 'Check the backend service\'s own logs for the failing subsystem.',
      retryHint: `Re-run once the failing subsystem recovers.`,
    };
  }

  // Unreachable.
  if (environment.isRemote) {
    return {
      ok: false,
      rootCause: `Backend at ${apiBaseUrl} is not reachable.`,
      suggestedFix: 'Check your network/VPN connection to the remote environment.',
      nextAction: `Retry once connectivity is confirmed: curl ${apiBaseUrl}${HEALTH_PATH}`,
      retryHint: 'Re-run this same command once connectivity is restored.',
    };
  }

  if (noBackendStart) {
    return {
      ok: false,
      rootCause: `Local backend not reachable at ${apiBaseUrl}.`,
      suggestedFix: '--no-backend-start was set, so nothing was started automatically.',
      nextAction: 'See infrastructure/docs/local-development-guide.md to start it manually.',
      docs: 'infrastructure/docs/local-development-guide.md',
    };
  }

  if (!existsSync(SIBLING_BACKEND_REPO)) {
    return {
      ok: false,
      rootCause: `Local backend not reachable at ${apiBaseUrl}, and the sibling repo (patheya-express-platform) was not found at ${SIBLING_BACKEND_REPO}.`,
      suggestedFix: 'Clone patheya-express-platform as a sibling of this repo, or start the backend manually.',
      nextAction: 'See infrastructure/docs/local-development-guide.md § "Running the backend alongside it".',
      docs: 'infrastructure/docs/local-development-guide.md',
    };
  }

  const startResult = await startSiblingBackend({ verbose });
  if (!startResult.ok) {
    // Compose itself failed to start anything — fail immediately rather than spending the full
    // START_POLL_TIMEOUT_MS polling a health endpoint that was never going to answer, and never
    // having logged the misleading "Started `docker compose up -d`..." success line in the first
    // place (that line only prints inside startSiblingBackend() after this same check passes).
    return startResult;
  }

  // Bounded and deterministic on both ends: the outer `while` never waits past
  // START_POLL_TIMEOUT_MS regardless of what's happening, and this counter lets a genuine
  // crash-loop (the container repeatedly exiting and being restarted by `restart: unless-stopped`
  // — Docker reports that transient state as "restarting") fail fast well before that deadline
  // instead of silently waiting out the full timeout for a container that will never come up.
  // Deliberately keyed on the literal "restarting" status, not "not running" in general: a
  // container that's merely `created` (still blocked on postgres/redis's own `depends_on:
  // condition: service_healthy`) is completely normal during a slow first-time image pull/health
  // check and must never be mistaken for a crash.
  const CRASH_LOOP_THRESHOLD = 3;
  let consecutiveRestarting = 0;
  let lastDiagnostics = null;

  const deadline = Date.now() + START_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, START_POLL_INTERVAL_MS));
    result = await checkHealth(apiBaseUrl);
    if (result.reachable && result.healthy) {
      log.ok(`Backend healthy at ${apiBaseUrl}`);
      reportHealthData(result.data);
      return { ok: true, apiBaseUrl, data: result.data };
    }

    lastDiagnostics = await collectApiGatewayDiagnostics();
    consecutiveRestarting = lastDiagnostics.containerStatus === 'restarting' ? consecutiveRestarting + 1 : 0;
    if (consecutiveRestarting >= CRASH_LOOP_THRESHOLD) {
      return {
        ok: false,
        rootCause: `The api-gateway container is crash-looping (status: ${lastDiagnostics.containerStatus}) instead of becoming healthy.`,
        suggestedFix: `Check ${COMPOSE_ENV_FILE_REL} for a value the backend's startup validation rejects — a common cause is a placeholder secret (see the log excerpt below).`,
        nextAction: `Full log: docker compose -f ${COMPOSE_FILE_REL} logs api-gateway  (from ${SIBLING_BACKEND_REPO})`,
        retryHint: 'Re-run this command once the underlying config problem is fixed.',
        diagnostics: formatDiagnosticsBlock(lastDiagnostics),
      };
    }
  }

  return {
    ok: false,
    rootCause: `Backend did not become healthy within ${START_POLL_TIMEOUT_MS / 1000}s of starting it.`,
    suggestedFix: `Check the sibling repo's own terminal/logs for startup errors: ${SIBLING_BACKEND_REPO}`,
    nextAction: `Once it's healthy, re-run this command — or pass --no-backend-start if you're already running it another way.`,
    retryHint: 'Re-run this command once the backend logs show it started successfully.',
    diagnostics: formatDiagnosticsBlock(lastDiagnostics),
  };
}
