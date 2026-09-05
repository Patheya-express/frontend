import { existsSync } from 'node:fs';
import { join } from 'node:path';
import spawn from 'cross-spawn';
import * as log from './log.mjs';
import { resolveApiBaseUrl, repoRoot } from './registry.mjs';
import { runCapture } from './exec.mjs';

const HEALTH_PATH = '/api/v1/health';
const HEALTH_TIMEOUT_MS = 4000;
const START_POLL_TIMEOUT_MS = 60_000;
const START_POLL_INTERVAL_MS = 2000;

// The backend lives in a sibling repo (patheya-express-platform), never in this one — see
// infrastructure/docs/local-development-guide.md. Auto-start is only attempted when that sibling
// directory is actually present next to this checkout; this repo has no way to know if it exists
// anywhere else, and guessing a path would be worse than just telling the developer what to run.
const SIBLING_BACKEND_REPO = join(repoRoot, '..', 'patheya-express-platform');

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

async function startSiblingBackend({ verbose }) {
  log.info('Local backend not reachable — attempting to start it from the sibling repo.');
  log.detail(SIBLING_BACKEND_REPO);

  // `docker compose up -d` (no service filter) starts the whole stack, api-gateway included —
  // see the sibling repo's infrastructure/docker/docker-compose.yml, whose `api-gateway` service
  // has no `profiles:` restriction and publishes :3000 itself. Deliberately NOT also spawning
  // `pnpm --filter api-gateway start:dev` here: that was this launcher's own past bug — it raced
  // the containerized api-gateway for the same port and produced EADDRINUSE the moment the
  // container won the race. If a developer intentionally runs api-gateway on the host instead of
  // in a container, they exclude it from Compose themselves (`docker compose up postgres redis
  // kafka zookeeper` — see infrastructure/docs/local-development-guide.md) and pass
  // --no-backend-start so this launcher doesn't fight that setup.
  const composeUp = spawn('docker', ['compose', '-f', 'infrastructure/docker/docker-compose.yml', 'up', '-d'], {
    cwd: SIBLING_BACKEND_REPO,
    stdio: verbose ? 'inherit' : 'ignore',
  });

  await new Promise((resolve) => composeUp.on('close', resolve));

  log.info('Started `docker compose up -d` (postgres, redis, kafka, zookeeper, api-gateway).');
  log.detail('Waiting for the health endpoint to report healthy…');
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

  await startSiblingBackend({ verbose });

  const deadline = Date.now() + START_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, START_POLL_INTERVAL_MS));
    result = await checkHealth(apiBaseUrl);
    if (result.reachable && result.healthy) {
      log.ok(`Backend healthy at ${apiBaseUrl}`);
      reportHealthData(result.data);
      return { ok: true, apiBaseUrl, data: result.data };
    }
  }

  return {
    ok: false,
    rootCause: `Backend did not become healthy within ${START_POLL_TIMEOUT_MS / 1000}s of starting it.`,
    suggestedFix: `Check the sibling repo's own terminal/logs for startup errors: ${SIBLING_BACKEND_REPO}`,
    nextAction: `Once it's healthy, re-run this command — or pass --no-backend-start if you're already running it another way.`,
    retryHint: 'Re-run this command once the backend logs show it started successfully.',
  };
}
