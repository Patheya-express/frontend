import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';
import {
  checkHealth,
  describeUnexpectedOccupant,
  buildComposeUpArgs,
  formatDiagnosticsBlock,
  redactSecrets,
  isMissingEnvFileError,
  formatComposeFailureDiagnostics,
} from '../lib/detect-backend.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '..', 'lib', 'detect-backend.mjs'), 'utf8');

/**
 * Uses a real local HTTP server on an OS-assigned free port rather than mocking `fetch` — fully
 * deterministic and portable (no network access needed, no experimental module-mocking API), and
 * exercises the actual HTTP client code path in checkHealth, not a stand-in for it. Deliberately
 * does NOT test detectBackend()'s `local`-environment branch end-to-end: that always resolves to
 * the hardcoded `http://localhost:3000` (see registry.mjs's resolveApiBaseUrl), which this test
 * machine may or may not have something listening on — asserting either way would be flaky across
 * environments. checkHealth (the part that actually talks to a URL) is fully covered here instead.
 *
 * Every response body below is wrapped in the real `{success, timestamp, data}` envelope the
 * backend's global ResponseInterceptor applies to every endpoint (see
 * apps/api-gateway/src/core/interceptors/response.interceptor.ts in the sibling
 * patheya-express-platform repo) — checkHealth must unwrap `data` before reading any field.
 */
describe('checkHealth', () => {
  let healthyServer;
  let healthyUrl;
  let degradedServer;
  let degradedUrl;
  let noQueuesServer;
  let noQueuesUrl;
  let non200Server;
  let non200Url;
  let unwrappedServer;
  let unwrappedUrl;
  let noDataServer;
  let noDataUrl;
  let notJsonServer;
  let notJsonUrl;

  before(async () => {
    healthyServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          timestamp: '2026-09-05T11:17:31.449Z',
          data: { status: 'ok', database: 'connected', redis: 'connected', queues: 'connected', websocket: 'ready' },
        }),
      );
    });
    await new Promise((resolve) => healthyServer.listen(0, resolve));
    healthyUrl = `http://127.0.0.1:${healthyServer.address().port}`;

    degradedServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          timestamp: '2026-09-05T11:17:31.449Z',
          data: { status: 'degraded', database: 'connected', redis: 'disconnected', queues: 'connected', websocket: 'ready' },
        }),
      );
    });
    await new Promise((resolve) => degradedServer.listen(0, resolve));
    degradedUrl = `http://127.0.0.1:${degradedServer.address().port}`;

    // Matches the actual verified response from the current Docker-based backend: `queues` is
    // simply absent (an older/different backend build than the one that added it) — this must
    // not be treated as unhealthy or malformed, and must never be reported as "undefined".
    noQueuesServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          timestamp: '2026-09-05T11:17:31.449Z',
          data: { status: 'ok', service: 'Patheya Express API', database: 'connected', redis: 'connected', websocket: 'ready', uptime: 534 },
        }),
      );
    });
    await new Promise((resolve) => noQueuesServer.listen(0, resolve));
    noQueuesUrl = `http://127.0.0.1:${noQueuesServer.address().port}`;

    non200Server = createServer((req, res) => {
      res.writeHead(503);
      res.end('service unavailable');
    });
    await new Promise((resolve) => non200Server.listen(0, resolve));
    non200Url = `http://127.0.0.1:${non200Server.address().port}`;

    // A flat, unwrapped body (the shape this launcher incorrectly assumed before) must be
    // rejected as malformed, not silently treated as healthy just because `status` isn't present
    // to contradict it.
    unwrappedServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', database: 'connected', redis: 'connected', queues: 'connected', websocket: 'ready' }));
    });
    await new Promise((resolve) => unwrappedServer.listen(0, resolve));
    unwrappedUrl = `http://127.0.0.1:${unwrappedServer.address().port}`;

    noDataServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    await new Promise((resolve) => noDataServer.listen(0, resolve));
    noDataUrl = `http://127.0.0.1:${noDataServer.address().port}`;

    notJsonServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('hello world');
    });
    await new Promise((resolve) => notJsonServer.listen(0, resolve));
    notJsonUrl = `http://127.0.0.1:${notJsonServer.address().port}`;
  });

  after(async () => {
    await Promise.all(
      [healthyServer, degradedServer, noQueuesServer, non200Server, unwrappedServer, noDataServer, notJsonServer].map(
        (server) => new Promise((resolve) => server.close(resolve)),
      ),
    );
  });

  test('a 200 response with data.status:"ok" is reachable and healthy, with data unwrapped from the envelope', async () => {
    const result = await checkHealth(healthyUrl);
    assert.equal(result.reachable, true);
    assert.equal(result.healthy, true);
    assert.equal(result.malformed, false);
    assert.equal(result.data.database, 'connected');
    assert.equal(result.data.websocket, 'ready');
  });

  test('a 200 response with data.status:"degraded" is reachable but not healthy', async () => {
    const result = await checkHealth(degradedUrl);
    assert.equal(result.reachable, true);
    assert.equal(result.healthy, false);
    assert.equal(result.malformed, false);
    assert.equal(result.data.redis, 'disconnected');
  });

  test('a healthy response missing the optional queues field is still healthy, with queues left undefined (never fabricated)', async () => {
    const result = await checkHealth(noQueuesUrl);
    assert.equal(result.reachable, true);
    assert.equal(result.healthy, true);
    assert.equal(result.data.database, 'connected');
    assert.equal(result.data.queues, undefined);
  });

  test('a non-2xx response is reachable but not healthy, with no data', async () => {
    const result = await checkHealth(non200Url);
    assert.equal(result.reachable, true);
    assert.equal(result.healthy, false);
    assert.equal(result.data, null);
    assert.equal(result.statusCode, 503);
  });

  test('a flat (unwrapped) body without the {success,data} envelope is reported as malformed, not healthy', async () => {
    const result = await checkHealth(unwrappedUrl);
    assert.equal(result.reachable, true);
    assert.equal(result.healthy, false);
    assert.equal(result.malformed, true);
    assert.equal(result.data, null);
  });

  test('success:true with no data field is malformed', async () => {
    const result = await checkHealth(noDataUrl);
    assert.equal(result.reachable, true);
    assert.equal(result.healthy, false);
    assert.equal(result.malformed, true);
  });

  test('a non-JSON 200 body is malformed, not a thrown exception', async () => {
    const result = await checkHealth(notJsonUrl);
    assert.equal(result.reachable, true);
    assert.equal(result.healthy, false);
    assert.equal(result.malformed, true);
  });

  test('a closed port is unreachable, not a thrown exception', async () => {
    // Port 1 is a reserved/typically-unbound TCP port — connecting to it on 127.0.0.1 fails fast
    // with ECONNREFUSED on every platform this launcher supports, without needing a real "nothing
    // is listening here" guarantee that could vary by environment.
    const result = await checkHealth('http://127.0.0.1:1');
    assert.equal(result.reachable, false);
    assert.equal(result.healthy, false);
    assert.equal(result.data, null);
  });

  test('an unresolvable host is unreachable, not a thrown exception', async () => {
    const result = await checkHealth('http://this-host-does-not-exist.invalid');
    assert.equal(result.reachable, false);
  });
});

describe('describeUnexpectedOccupant', () => {
  test('never throws and always returns a non-empty string, regardless of platform', async () => {
    // Deliberately not asserting Windows-specific netstat/tasklist parsing here — this function's
    // job on non-Windows platforms is the documented "not identified automatically" fallback (see
    // its own doc comment / DEVELOPMENT.md's known limitation), and on Windows it's inherently
    // dependent on whatever real process happens to be on this port on the machine running the
    // test, which isn't something a unit test should assert either way.
    const result = await describeUnexpectedOccupant('http://127.0.0.1:1');
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  });

  test('a malformed apiBaseUrl does not throw', async () => {
    const result = await describeUnexpectedOccupant('not-a-valid-url');
    assert.equal(typeof result, 'string');
  });
});

/**
 * THIRD FRESH-MACHINE FAILURE regression coverage: the api-gateway container crash-looped because
 * `docker compose up` was invoked with no `--env-file` at all, silently falling back to
 * docker-compose.yml's own placeholder JWT defaults. buildComposeUpArgs() is the one place that
 * argv is assembled — asserting its shape directly (rather than only exercising it end-to-end
 * through a real `docker compose` call, which this test suite deliberately never does) is enough
 * to guarantee the fix can't silently regress.
 */
describe('buildComposeUpArgs', () => {
  test('passes --env-file pointing at .env.compose, never .env.compose.example', () => {
    const args = buildComposeUpArgs();
    const envFileIndex = args.indexOf('--env-file');
    assert.ok(envFileIndex !== -1, 'expected an explicit --env-file flag');
    const envFileValue = args[envFileIndex + 1];
    assert.match(envFileValue, /infrastructure[\\/]docker[\\/]\.env\.compose$/);
    assert.doesNotMatch(envFileValue, /\.env\.compose\.example/);
  });

  test('passes -f pointing at the real docker-compose.yml', () => {
    const args = buildComposeUpArgs();
    const fIndex = args.indexOf('-f');
    assert.ok(fIndex !== -1);
    assert.match(args[fIndex + 1], /infrastructure[\\/]docker[\\/]docker-compose\.yml$/);
  });

  test('never passes --env-file before "compose" (must be a top-level compose flag, not an `up` subcommand flag)', () => {
    const args = buildComposeUpArgs();
    assert.equal(args[0], 'compose');
    assert.ok(args.indexOf('--env-file') < args.indexOf('up'));
  });

  test('brings up the whole stack (no service filter) and never spawns a host api-gateway process', () => {
    const args = buildComposeUpArgs();
    assert.ok(args.includes('up'));
    assert.ok(args.includes('-d'));
    assert.doesNotMatch(args.join(' '), /start:dev|api-gateway/);
  });
});

describe('formatDiagnosticsBlock', () => {
  test('returns null when nothing is available (Docker unreachable / container never created)', () => {
    assert.equal(formatDiagnosticsBlock({ containerStatus: null, recentLogs: null }), null);
    assert.equal(formatDiagnosticsBlock(), null);
  });

  test('includes the container status when present', () => {
    const block = formatDiagnosticsBlock({ containerStatus: 'restarting', recentLogs: null });
    assert.match(block, /restarting/);
  });

  test('includes recent log output when present, capped to what collectApiGatewayDiagnostics already tailed', () => {
    const block = formatDiagnosticsBlock({ containerStatus: 'restarting', recentLogs: 'JWT_ACCESS_SECRET still contains an unedited placeholder value' });
    assert.match(block, /restarting/);
    assert.match(block, /placeholder value/);
  });
});

describe('redactSecrets [H]', () => {
  test('masks a JWT_ACCESS_SECRET/JWT_REFRESH_SECRET line, leaving the key name visible', () => {
    const text = 'NODE_ENV=development\nJWT_ACCESS_SECRET=yZCDAl2J/IvN6YfaTQz+vJZGE2R45JFfmZ4gwFykZACYeikZ5juFlBW//dNK21/f\nPORT=3000';
    const redacted = redactSecrets(text);
    assert.doesNotMatch(redacted, /yZCDAl2J/, 'the actual secret value must not survive redaction');
    assert.match(redacted, /JWT_ACCESS_SECRET=\[redacted\]/);
    assert.match(redacted, /NODE_ENV=development/, 'unrelated lines must be untouched');
    assert.match(redacted, /PORT=3000/, 'unrelated lines must be untouched');
  });

  test('masks both secret keys independently, even on the same line-separated blob', () => {
    const text = 'JWT_ACCESS_SECRET=aaaa1111\nJWT_REFRESH_SECRET=bbbb2222\n';
    const redacted = redactSecrets(text);
    assert.doesNotMatch(redacted, /aaaa1111|bbbb2222/);
    assert.match(redacted, /JWT_ACCESS_SECRET=\[redacted\]/);
    assert.match(redacted, /JWT_REFRESH_SECRET=\[redacted\]/);
  });

  test('text with no secret-shaped lines passes through unchanged', () => {
    const text = "couldn't find env file: C:\\repo\\infrastructure\\docker\\.env.compose";
    assert.equal(redactSecrets(text), text);
  });
});

describe('isMissingEnvFileError [E]', () => {
  test('true for the exact stderr Docker Compose prints for a nonexistent --env-file (verified against a real `docker compose` invocation)', () => {
    // The literal message below was captured from a real `docker compose --env-file
    // <nonexistent> -f infrastructure/docker/docker-compose.yml config` run against the actual
    // backend repo during development of this fix — not invented/guessed text.
    const composeUp = { code: 1, stdout: '', stderr: "couldn't find env file: C:\\Users\\dev\\patheya-express-platform\\infrastructure\\docker\\.env.compose\n" };
    assert.equal(isMissingEnvFileError(composeUp), true);
  });

  test('false for an unrelated compose failure', () => {
    const composeUp = { code: 1, stdout: '', stderr: 'Error response from daemon: driver failed programming external connectivity\n' };
    assert.equal(isMissingEnvFileError(composeUp), false);
  });

  test('false / does not throw when stderr is absent', () => {
    assert.equal(isMissingEnvFileError({ code: 1 }), false);
  });
});

describe('formatComposeFailureDiagnostics [C, D, E, H]', () => {
  test('returns null when there is genuinely no output (e.g. the docker binary itself is missing)', () => {
    assert.equal(formatComposeFailureDiagnostics({ code: null, stdout: '', stderr: '' }), null);
  });

  test('surfaces a missing-env-file failure\'s actual message', () => {
    const composeUp = { code: 1, stdout: '', stderr: "couldn't find env file: infrastructure/docker/.env.compose\n" };
    const diagnostics = formatComposeFailureDiagnostics(composeUp);
    assert.match(diagnostics, /couldn't find env file/);
  });

  test('redacts a secret if Compose\'s own output happens to echo one back', () => {
    const composeUp = { code: 1, stdout: '', stderr: 'invalid env file line: JWT_ACCESS_SECRET=super-secret-real-value-123\n' };
    const diagnostics = formatComposeFailureDiagnostics(composeUp);
    assert.doesNotMatch(diagnostics, /super-secret-real-value-123/);
    assert.match(diagnostics, /\[redacted\]/);
  });

  test('truncates to the last 40 lines, same cap as the container-log diagnostics', () => {
    const manyLines = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n');
    const diagnostics = formatComposeFailureDiagnostics({ code: 1, stdout: manyLines, stderr: '' });
    const lineCount = diagnostics.split('\n').length;
    assert.ok(lineCount <= 40, `expected at most 40 lines, got ${lineCount}`);
    assert.match(diagnostics, /line 99/, 'must keep the tail (most recent output), not the head');
    assert.doesNotMatch(diagnostics, /line 0\b/, 'must have dropped the earliest lines');
  });
});

/**
 * startSiblingBackend() and detectBackend()'s Compose-failure branch aren't practically unit-
 * testable without either a real Docker daemon (this suite deliberately never depends on one — see
 * this file's own top-of-file doc comment) or invasively refactoring startSiblingBackend() to
 * accept an injectable command runner, which isn't warranted for three lines of control flow. The
 * pure logic those branches depend on (formatComposeFailureDiagnostics/isMissingEnvFileError/
 * redactSecrets above) is fully covered with real, non-mocked inputs instead; this describe block
 * verifies the actual control-flow guarantee at the source level — the same technique
 * tools/dev/test/bootstrap.test.mjs already relies on for equivalent "can't easily execute, but can
 * verify structurally" properties.
 */
describe('startSiblingBackend / detectBackend exit-code handling (source-level) [C, D]', () => {
  test('[D] the "Started `docker compose up -d`..." success log only appears after the composeUp.code !== 0 check, never before it', () => {
    const successLogIndex = source.indexOf('log.info(\'Started `docker compose up -d`');
    const exitCodeCheckIndex = source.indexOf('if (composeUp.code !== 0)');
    assert.ok(successLogIndex !== -1 && exitCodeCheckIndex !== -1);
    assert.ok(exitCodeCheckIndex < successLogIndex, 'the exit-code check must run before the success log line, so a failed compose command can never be logged as started');

    // And the failure branch must return before reaching that log line at all.
    const failureBranch = source.slice(exitCodeCheckIndex, successLogIndex);
    assert.match(failureBranch, /return\s*\{/, 'the composeUp.code !== 0 branch must return early, never falling through to the success log');
  });

  test('[C] detectBackend returns startSiblingBackend\'s failure immediately, before the health-poll loop is ever entered', () => {
    const startCallIndex = source.indexOf('const startResult = await startSiblingBackend({ verbose });');
    const notOkCheckIndex = source.indexOf('if (!startResult.ok) {', startCallIndex);
    const pollLoopIndex = source.indexOf('const deadline = Date.now() + START_POLL_TIMEOUT_MS;');
    assert.ok(startCallIndex !== -1 && notOkCheckIndex !== -1 && pollLoopIndex !== -1);
    assert.ok(startCallIndex < notOkCheckIndex && notOkCheckIndex < pollLoopIndex, 'the !startResult.ok check must sit between calling startSiblingBackend and starting the health-poll loop');

    const guardSection = source.slice(notOkCheckIndex, pollLoopIndex);
    assert.match(guardSection, /return startResult;/, 'a failed startSiblingBackend must return immediately, never reaching the poll loop');
  });

  test('startSiblingBackend uses runCapture (exit code inspected), not a fire-and-forget spawn', () => {
    const fnStart = source.indexOf('async function startSiblingBackend');
    const fnEnd = source.indexOf('\n}', fnStart) + 2;
    const fnBody = source.slice(fnStart, fnEnd);
    assert.match(fnBody, /await runCapture\('docker', buildComposeUpArgs\(\)/, 'expected the compose invocation to go through runCapture so its exit code is available to check');
    assert.doesNotMatch(fnBody, /\.on\('close'/, 'a manual close-event listener would mean the exit code is being ignored again');
  });
});
