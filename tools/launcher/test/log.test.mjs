import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as log from '../lib/log.mjs';

function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

async function captureConsole(fn) {
  const lines = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (text) => lines.push(stripAnsi(String(text)));
  console.error = (text) => lines.push(stripAnsi(String(text)));
  try {
    const result = await fn();
    return { result, lines };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

afterEach(() => {
  log.setVerbose(false); // tests must not leak verbose state into each other
});

describe('formatDuration', () => {
  test('sub-second durations render in ms', () => {
    assert.equal(log.formatDuration(42), '42ms');
    assert.equal(log.formatDuration(999), '999ms');
  });

  test('durations of 1s or more render in seconds with one decimal', () => {
    assert.equal(log.formatDuration(1000), '1.0s');
    assert.equal(log.formatDuration(7600), '7.6s');
  });
});

describe('StepTimer', () => {
  test('elapsed() returns a formatted, monotonically non-decreasing value', async () => {
    const timer = new log.StepTimer();
    const first = timer.elapsedMs();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = timer.elapsedMs();
    assert.ok(second >= first);
  });
});

describe('verbose gating', () => {
  test('debug()/trace() are silent by default', async () => {
    log.setVerbose(false);
    const { lines } = await captureConsole(() => {
      log.debug('should not appear');
      log.trace('should not appear either');
    });
    assert.deepEqual(lines, []);
  });

  test('debug()/trace() print once setVerbose(true) is called', async () => {
    log.setVerbose(true);
    const { lines } = await captureConsole(() => {
      log.debug('now visible');
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /now visible/);
  });

  test('isVerbose() reflects the current state', () => {
    log.setVerbose(true);
    assert.equal(log.isVerbose(), true);
    log.setVerbose(false);
    assert.equal(log.isVerbose(), false);
  });
});

describe('failWithGuidance', () => {
  test('always prints rootCause; optional fields only print when provided', async () => {
    const { lines } = await captureConsole(() => {
      log.failWithGuidance({ rootCause: 'Something broke.' });
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /Something broke\./);
  });

  test('prints Fix/Next/Retry/Docs when given, in that order', async () => {
    const { lines } = await captureConsole(() => {
      log.failWithGuidance({
        rootCause: 'Broke.',
        suggestedFix: 'Do X.',
        nextAction: 'Then Y.',
        retryHint: 'Retry after Z.',
        docs: 'https://example.com/docs',
      });
    });
    assert.equal(lines.length, 5);
    assert.match(lines[1], /Fix:.*Do X\./);
    assert.match(lines[2], /Next:.*Then Y\./);
    assert.match(lines[3], /Retry:.*Retry after Z\./);
    assert.match(lines[4], /Docs:.*example\.com/);
  });

  test('stack trace only prints when verbose is true', async () => {
    const error = new Error('boom');

    const quiet = await captureConsole(() => log.failWithGuidance({ rootCause: 'x', error, verbose: false }));
    assert.ok(!quiet.lines.some((l) => l.includes('boom')));

    const loud = await captureConsole(() => log.failWithGuidance({ rootCause: 'x', error, verbose: true }));
    assert.ok(loud.lines.some((l) => l.includes('Error: boom') || l.includes('boom')));
  });
});

describe('output capture (runCaptured/flush)', () => {
  test('runCaptured buffers output instead of printing immediately', async () => {
    const { lines: outerLines, result } = await captureConsole(async () => {
      const { result: inner, lines } = await log.runCaptured(async () => {
        log.ok('buffered message');
        return 'done';
      });
      // Nothing should have reached the real console yet — captureConsole's own buffer (outerLines)
      // should be empty at this point, proving runCaptured genuinely intercepted the write.
      return { inner, lines };
    });
    assert.equal(result.inner, 'done');
    assert.equal(result.lines.length, 1);
    assert.match(result.lines[0].text, /buffered message/);
    assert.deepEqual(outerLines, [], 'the buffered message must not have reached the real console at all');
  });

  test('flush() prints a captured buffer\'s lines in original order', async () => {
    const { lines: captured } = await log.runCaptured(async () => {
      log.ok('first');
      log.warn('second');
    });

    const { lines: printed } = await captureConsole(() => log.flush(captured));
    assert.equal(printed.length, 2);
    assert.match(printed[0], /first/);
    assert.match(printed[1], /second/);
  });

  test('two concurrent runCaptured calls do not leak output into each other', async () => {
    const [a, b] = await Promise.all([
      log.runCaptured(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        log.ok('from A');
        return 'a';
      }),
      log.runCaptured(async () => {
        log.ok('from B');
        return 'b';
      }),
    ]);

    assert.equal(a.lines.length, 1);
    assert.match(a.lines[0].text, /from A/);
    assert.equal(b.lines.length, 1);
    assert.match(b.lines[0].text, /from B/);
  });
});

describe('printDashboard / printTimingBreakdown', () => {
  test('printDashboard renders every row label and value', async () => {
    const { lines } = await captureConsole(() => {
      log.printDashboard({
        title: 'Test Dashboard',
        rows: [
          ['Application', 'Customer'],
          ['Backend', 'Healthy'],
        ],
        footer: 'Done.',
      });
    });
    const joined = lines.join('\n');
    assert.match(joined, /Test Dashboard/);
    assert.match(joined, /Application/);
    assert.match(joined, /Customer/);
    assert.match(joined, /Backend/);
    assert.match(joined, /Healthy/);
    assert.match(joined, /Done\./);
  });

  test('printTimingBreakdown includes every stage and the total', async () => {
    const { lines } = await captureConsole(() => {
      log.printTimingBreakdown([{ name: 'Environment', elapsed: '100ms' }, { name: 'Sync', elapsed: 'Skipped' }], '2.5s');
    });
    const joined = lines.join('\n');
    assert.match(joined, /Environment/);
    assert.match(joined, /100ms/);
    assert.match(joined, /Skipped/);
    assert.match(joined, /Total/);
    assert.match(joined, /2\.5s/);
  });
});
