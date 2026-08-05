import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { checkHealth } from '../lib/detect-backend.mjs';

/**
 * Uses a real local HTTP server on an OS-assigned free port rather than mocking `fetch` — fully
 * deterministic and portable (no network access needed, no experimental module-mocking API), and
 * exercises the actual HTTP client code path in checkHealth, not a stand-in for it. Deliberately
 * does NOT test detectBackend()'s `local`-environment branch end-to-end: that always resolves to
 * the hardcoded `http://localhost:3000` (see registry.mjs's resolveApiBaseUrl), which this test
 * machine may or may not have something listening on — asserting either way would be flaky across
 * environments. checkHealth (the part that actually talks to a URL) is fully covered here instead.
 */
describe('checkHealth', () => {
  let healthyServer;
  let healthyUrl;
  let degradedServer;
  let degradedUrl;
  let non200Server;
  let non200Url;

  before(async () => {
    healthyServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', database: 'connected', redis: 'connected', queues: 'connected', websocket: 'ready' }));
    });
    await new Promise((resolve) => healthyServer.listen(0, resolve));
    healthyUrl = `http://127.0.0.1:${healthyServer.address().port}`;

    degradedServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'degraded', database: 'connected', redis: 'disconnected', queues: 'connected', websocket: 'ready' }));
    });
    await new Promise((resolve) => degradedServer.listen(0, resolve));
    degradedUrl = `http://127.0.0.1:${degradedServer.address().port}`;

    non200Server = createServer((req, res) => {
      res.writeHead(503);
      res.end('service unavailable');
    });
    await new Promise((resolve) => non200Server.listen(0, resolve));
    non200Url = `http://127.0.0.1:${non200Server.address().port}`;
  });

  after(async () => {
    await Promise.all([
      new Promise((resolve) => healthyServer.close(resolve)),
      new Promise((resolve) => degradedServer.close(resolve)),
      new Promise((resolve) => non200Server.close(resolve)),
    ]);
  });

  test('a 200 response with status:"ok" is reachable and healthy, with the full body attached', async () => {
    const result = await checkHealth(healthyUrl);
    assert.equal(result.reachable, true);
    assert.equal(result.healthy, true);
    assert.equal(result.body.database, 'connected');
    assert.equal(result.body.websocket, 'ready');
  });

  test('a 200 response with status:"degraded" is reachable but not healthy', async () => {
    const result = await checkHealth(degradedUrl);
    assert.equal(result.reachable, true);
    assert.equal(result.healthy, false);
    assert.equal(result.body.redis, 'disconnected');
  });

  test('a non-2xx response is reachable but not healthy, with no body', async () => {
    const result = await checkHealth(non200Url);
    assert.equal(result.reachable, true);
    assert.equal(result.healthy, false);
    assert.equal(result.body, null);
    assert.equal(result.statusCode, 503);
  });

  test('a closed port is unreachable, not a thrown exception', async () => {
    // Port 1 is a reserved/typically-unbound TCP port — connecting to it on 127.0.0.1 fails fast
    // with ECONNREFUSED on every platform this launcher supports, without needing a real "nothing
    // is listening here" guarantee that could vary by environment.
    const result = await checkHealth('http://127.0.0.1:1');
    assert.equal(result.reachable, false);
    assert.equal(result.healthy, false);
    assert.equal(result.body, null);
  });

  test('an unresolvable host is unreachable, not a thrown exception', async () => {
    const result = await checkHealth('http://this-host-does-not-exist.invalid');
    assert.equal(result.reachable, false);
  });
});
