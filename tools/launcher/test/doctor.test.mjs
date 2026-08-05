import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runCapture } from '../lib/exec.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const doctorPath = join(__dirname, '..', 'doctor.mjs');

/**
 * Integration smoke test — spawns the real doctor.mjs. Doctor always finishes and reports a
 * result (exit 0 if nothing failed, 1 if something did); on this development machine, without a
 * full Android/iOS/backend setup, various checks are expected to fail — this test asserts doctor
 * ran to completion and produced a well-formed report, not that every check passed (that would be
 * asserting about *this specific machine's* toolchain, not about doctor.mjs's correctness).
 */
describe('doctor.mjs', () => {
  test('runs to completion and reports every section, without crashing', async () => {
    const result = await runCapture(process.execPath, [doctorPath], { cwd: join(__dirname, '..', '..', '..') });

    // Exit code is 0 (all checks passed) or 1 (something failed) — never anything else (which
    // would indicate an uncaught exception/crash rather than a normal "here's what I found").
    assert.ok(result.code === 0 || result.code === 1, `expected exit 0 or 1, got ${result.code}`);

    for (const section of ['Development Tools', 'Customer App Configuration', 'Backend', 'Doctor Summary']) {
      assert.match(result.stdout, new RegExp(section), `expected "${section}" section in doctor's output`);
    }

    assert.match(result.stdout, /Passed/);
    assert.match(result.stdout, /Failed/);
    assert.match(result.stdout, /Total Time/);
  });

  test('--verbose does not change whether it completes successfully', async () => {
    const result = await runCapture(process.execPath, [doctorPath, '--verbose'], { cwd: join(__dirname, '..', '..', '..') });
    assert.ok(result.code === 0 || result.code === 1);
  });
});
