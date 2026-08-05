import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runChecks, buildToolChecks, buildAppChecks } from '../lib/validate-environment.mjs';

async function silently(fn) {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => undefined;
  console.error = () => undefined;
  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

function fakeCheck({ label, severity = 'error', shouldRun = true, ok }) {
  return { label, severity, shouldRun, run: async () => ({ ok, detail: ok ? null : `${label} failed` }) };
}

describe('runChecks: severity aggregation', () => {
  test('all passing checks: ok:true, nothing in failed/warnings', async () => {
    const descriptors = [fakeCheck({ label: 'A', ok: true }), fakeCheck({ label: 'B', ok: true })];
    const result = await silently(() => runChecks(descriptors));
    assert.equal(result.ok, true);
    assert.equal(result.failed.length, 0);
    assert.equal(result.warnings.length, 0);
    assert.equal(result.checks.length, 2);
  });

  test('a failing error-severity check makes ok:false', async () => {
    const descriptors = [fakeCheck({ label: 'A', ok: true }), fakeCheck({ label: 'B', ok: false, severity: 'error' })];
    const result = await silently(() => runChecks(descriptors));
    assert.equal(result.ok, false);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].label, 'B');
  });

  test('a failing warning-severity check does NOT make ok:false', async () => {
    const descriptors = [fakeCheck({ label: 'A', ok: true }), fakeCheck({ label: 'B', ok: false, severity: 'warning' })];
    const result = await silently(() => runChecks(descriptors));
    assert.equal(result.ok, true, 'warnings must not block');
    assert.equal(result.failed.length, 0);
    assert.equal(result.warnings.length, 1);
  });

  test('shouldRun:false excludes a check entirely — not counted as passed, failed, or warned', async () => {
    const descriptors = [fakeCheck({ label: 'A', ok: true }), fakeCheck({ label: 'Skip me', ok: false, shouldRun: false })];
    const result = await silently(() => runChecks(descriptors));
    assert.equal(result.checks.length, 1);
    assert.ok(!result.checks.some((c) => c.label === 'Skip me'));
  });

  test('mixed pass/fail/warning produces correct counts', async () => {
    const descriptors = [
      fakeCheck({ label: 'pass-1', ok: true }),
      fakeCheck({ label: 'pass-2', ok: true }),
      fakeCheck({ label: 'fail-1', ok: false, severity: 'error' }),
      fakeCheck({ label: 'warn-1', ok: false, severity: 'warning' }),
      fakeCheck({ label: 'warn-2', ok: false, severity: 'warning' }),
    ];
    const result = await silently(() => runChecks(descriptors));
    assert.equal(result.checks.length, 5);
    assert.equal(result.failed.length, 1);
    assert.equal(result.warnings.length, 2);
    assert.equal(result.ok, false);
  });

  test('checks run concurrently, not sequentially (Task 4)', async () => {
    const order = [];
    const descriptors = [
      {
        label: 'slow',
        severity: 'error',
        shouldRun: true,
        run: async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          order.push('slow');
          return { ok: true };
        },
      },
      {
        label: 'fast',
        severity: 'error',
        shouldRun: true,
        run: async () => {
          order.push('fast');
          return { ok: true };
        },
      },
    ];
    await silently(() => runChecks(descriptors));
    assert.deepEqual(order, ['fast', 'slow'], 'the fast check must finish before the slow one if they truly ran concurrently');
  });
});

describe('buildToolChecks / buildAppChecks: shape smoke tests', () => {
  test('buildToolChecks(web) returns well-formed descriptors and excludes native-only checks', () => {
    const descriptors = buildToolChecks({ platform: 'web' });
    assert.ok(descriptors.length > 0);
    for (const d of descriptors) {
      assert.equal(typeof d.label, 'string');
      assert.equal(typeof d.run, 'function');
    }
    const androidOnly = descriptors.find((d) => d.label.startsWith('Java'));
    assert.equal(androidOnly.shouldRun, false, 'Java check should not run for the web platform');
  });

  test('buildToolChecks(android) enables Java/Gradle-adjacent checks', () => {
    const descriptors = buildToolChecks({ platform: 'android' });
    const java = descriptors.find((d) => d.label.startsWith('Java'));
    assert.equal(java.shouldRun, true);
  });

  test('buildToolChecks("all") enables both Android and iOS checks at once (doctor.mjs\'s use case)', () => {
    const descriptors = buildToolChecks({ platform: 'all' });
    assert.equal(descriptors.find((d) => d.label.startsWith('Java')).shouldRun, true);
    assert.equal(descriptors.find((d) => d.label === 'Xcode').shouldRun, true);
  });

  test('buildAppChecks scopes native-project checks to platforms the app actually supports', () => {
    const webOnlyApp = { alias: 'admin', project: 'admin-app', displayName: 'Admin App', platforms: { web: true, android: false, ios: false } };
    const descriptors = buildAppChecks({ app: webOnlyApp, platform: 'all', envName: 'local' });
    const androidCheck = descriptors.find((d) => d.label === 'Android native project');
    assert.equal(androidCheck.shouldRun, false, 'admin-app does not support android, so this must not run even under platform:"all"');
  });

  test('Razorpay check is only "error" severity for the customer app', () => {
    const customer = { alias: 'customer', project: 'customer-app', displayName: 'Customer App', platforms: { web: true, android: true, ios: true } };
    const partner = { alias: 'partner', project: 'restaurant-app', displayName: 'Partner App', platforms: { web: true, android: true, ios: true } };

    const customerCheck = buildAppChecks({ app: customer, platform: 'web', envName: 'local' }).find((d) => d.label === 'Razorpay configuration');
    const partnerCheck = buildAppChecks({ app: partner, platform: 'web', envName: 'local' }).find((d) => d.label === 'Razorpay configuration');

    assert.equal(customerCheck.severity, 'error');
    assert.equal(partnerCheck.severity, 'warning');
  });
});
