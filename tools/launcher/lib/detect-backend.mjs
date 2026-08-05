import { existsSync } from 'node:fs';
import { join } from 'node:path';
import spawn from 'cross-spawn';
import * as log from './log.mjs';
import { resolveApiBaseUrl, repoRoot } from './registry.mjs';

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
 * Hits the real backend health endpoint (GET /api/v1/health) — its response genuinely reports
 * database/redis/queues/websocket status (see libs/shared/api-sdk's HealthResponseDto), so this
 * reflects the backend's own view of its subsystems rather than the launcher independently
 * reimplementing Postgres/Redis/BullMQ connectivity checks it has no credentials to perform.
 */
export async function checkHealth(apiBaseUrl) {
  try {
    const response = await fetch(new URL(HEALTH_PATH, apiBaseUrl), { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    if (!response.ok) {
      return { reachable: true, healthy: false, statusCode: response.status, body: null };
    }
    const body = await response.json();
    return { reachable: true, healthy: body.status === 'ok', statusCode: response.status, body };
  } catch {
    return { reachable: false, healthy: false, statusCode: null, body: null };
  }
}

function reportHealthBody(body) {
  const subsystem = (label, value, healthyValue) => {
    if (value === healthyValue) {
      log.ok(`${label}: ${value}`);
    } else {
      log.warn(`${label}: ${value}`);
    }
  };

  subsystem('Database', body.database, 'connected');
  subsystem('Redis', body.redis, 'connected');
  subsystem('BullMQ queues', body.queues, 'connected');
  if (body.websocket !== 'not_applicable') {
    subsystem('Socket.IO', body.websocket, 'ready');
  }
}

async function startSiblingBackend({ verbose }) {
  log.info('Local backend not reachable — attempting to start it from the sibling repo.');
  log.detail(SIBLING_BACKEND_REPO);

  // Neither of these processes exits on its own (docker compose -d does, start:dev doesn't), so
  // they're spawned detached/unref'd rather than awaited — this step's job is to kick them off
  // and then poll the health endpoint, not to hold the launcher open forever babysitting them.
  const composeUp = spawn('docker', ['compose', '-f', 'infrastructure/docker/docker-compose.yml', 'up', '-d'], {
    cwd: SIBLING_BACKEND_REPO,
    stdio: verbose ? 'inherit' : 'ignore',
  });

  await new Promise((resolve) => composeUp.on('close', resolve));

  const apiGateway = spawn('pnpm', ['--filter', 'api-gateway', 'start:dev'], {
    cwd: SIBLING_BACKEND_REPO,
    stdio: verbose ? 'inherit' : 'ignore',
    detached: process.platform !== 'win32',
  });
  apiGateway.unref();

  log.info('Started `docker compose up -d` and `pnpm --filter api-gateway start:dev` in the background.');
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
    reportHealthBody(result.body);
    return { ok: true, apiBaseUrl, body: result.body };
  }

  if (result.reachable && !result.healthy) {
    log.warn(`Backend reachable but reporting degraded status at ${apiBaseUrl}`);
    if (result.body) {
      reportHealthBody(result.body);
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
      reportHealthBody(result.body);
      return { ok: true, apiBaseUrl, body: result.body };
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
