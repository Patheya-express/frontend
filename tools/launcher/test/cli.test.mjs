import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runCapture } from '../lib/exec.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, '..', 'cli.mjs');

/**
 * Integration smoke tests — spawns the real cli.mjs as a child process for the guard-rail paths
 * that fail fast (before touching the network or a real device), the same paths verified manually
 * during development. No real device or backend required for any of these: they all exit before
 * Step 2 (backend detection) ever runs.
 */
describe('cli.mjs guard rails', () => {
  test('no arguments prints usage and exits 1', async () => {
    const result = await runCapture(process.execPath, [cliPath]);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /Usage: node tools\/launcher\/cli\.mjs/);
  });

  test('unknown app exits 1 with a helpful list of valid apps', async () => {
    const result = await runCapture(process.execPath, [cliPath, 'bogus', 'web']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Unknown app "bogus"/);
    assert.match(result.stderr, /customer/);
  });

  test('unknown platform exits 1', async () => {
    const result = await runCapture(process.execPath, [cliPath, 'customer', 'bogus']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Unknown platform "bogus"/);
  });

  test('a platform the app does not support exits 1 with the supported list', async () => {
    const result = await runCapture(process.execPath, [cliPath, 'admin', 'android']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /does not support "android"/);
    assert.match(result.stderr, /web/);
  });

  test('unknown environment exits 1', async () => {
    const result = await runCapture(process.execPath, [cliPath, 'customer', 'web', '--env=bogus']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Unknown environment "bogus"/);
  });

  test('unknown device profile exits 1', async () => {
    const result = await runCapture(process.execPath, [cliPath, 'customer', 'android', '--profile=bogus']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Unknown device profile "bogus"/);
  });
});
