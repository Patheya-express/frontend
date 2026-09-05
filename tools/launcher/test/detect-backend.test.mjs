import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { checkHealth, describeUnexpectedOccupant } from '../lib/detect-backend.mjs';

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
