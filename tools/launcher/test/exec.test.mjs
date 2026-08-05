import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runCapture, commandExists } from '../lib/exec.mjs';

// `node` itself is the one external command guaranteed present in every environment this suite
// runs in (it's what's executing the test) — used as a stand-in "real" command instead of mocking
// child_process, so these tests exercise the actual cross-spawn code path.
describe('runCapture', () => {
  test('captures stdout from a real process', async () => {
    const result = await runCapture(process.execPath, ['-e', "process.stdout.write('hello')"]);
    assert.equal(result.code, 0);
    assert.equal(result.stdout, 'hello');
    assert.equal(result.error, null);
  });

  test('captures stderr separately from stdout', async () => {
    const result = await runCapture(process.execPath, ['-e', "process.stderr.write('oops')"]);
    assert.equal(result.stderr, 'oops');
    assert.equal(result.stdout, '');
  });

  test('captures a non-zero exit code without throwing', async () => {
    const result = await runCapture(process.execPath, ['-e', 'process.exit(7)']);
    assert.equal(result.code, 7);
    assert.equal(result.error, null);
  });

  test('a nonexistent command resolves with an ENOENT-shaped error, never rejects', async () => {
    const result = await runCapture('this-command-definitely-does-not-exist-xyz-123');
    assert.equal(result.code, null);
    assert.ok(result.error, 'expected an error object for a missing binary');
  });
});

describe('commandExists', () => {
  test('true for a real, guaranteed-present executable', async () => {
    // process.execPath is an absolute path to the running Node binary — always exists.
    assert.equal(await commandExists(process.execPath, '--version'), true);
  });

  test('false for a command that does not exist on PATH', async () => {
    assert.equal(await commandExists('this-command-definitely-does-not-exist-xyz-123'), false);
  });
});
