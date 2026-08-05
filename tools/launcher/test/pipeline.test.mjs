import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createStage, runPipeline } from '../lib/pipeline.mjs';
import * as log from '../lib/log.mjs';

/** Captures everything written to console.log/console.error during `fn` at the real-console
 *  level, restoring it afterwards even if `fn` throws. This is the *outer* capture, standing in
 *  for a real terminal — it's what proves runPipeline's inner AsyncLocalStorage-based buffering
 *  (log.runCaptured/flush) actually reordered things, rather than just re-implementing the same
 *  buffering in the test. Stage bodies below must log through log.mjs's functions (log.ok, etc.),
 *  not raw console.log — only calls routed through log.write() participate in that buffering. */
async function captureConsole(fn) {
  const lines = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (text) => lines.push(String(text));
  console.error = (text) => lines.push(String(text));
  try {
    const result = await fn();
    return { result, lines };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

describe('createStage', () => {
  test('applies defaults to always-true; summary defaults to empty array', () => {
    const stage = createStage({ name: 'Test', execute: async () => ({ ok: true }) });
    assert.equal(stage.applies({}), true);
    assert.deepEqual(stage.summary({}), []);
  });
});

describe('runPipeline: sequential stages', () => {
  test('a single successful stage reports ok:true and one timing entry', async () => {
    const stage = createStage({ name: 'Alpha', execute: async () => ({ ok: true }) });
    const { result } = await captureConsole(() => runPipeline([stage], {}));
    assert.equal(result.ok, true);
    assert.equal(result.timings.length, 1);
    assert.equal(result.timings[0].name, 'Alpha');
  });

  test('a failing stage halts the pipeline before later entries run', async () => {
    let ranSecond = false;
    const first = createStage({ name: 'First', execute: async () => ({ ok: false, rootCause: 'boom' }) });
    const second = createStage({
      name: 'Second',
      execute: async () => {
        ranSecond = true;
        return { ok: true };
      },
    });

    const { result } = await captureConsole(() => runPipeline([first, second], {}));
    assert.equal(result.ok, false);
    assert.equal(ranSecond, false, 'second stage must not run after the first failed');
  });

  test('a stage whose applies() returns false is skipped entirely — not run, not reported', async () => {
    let executed = false;
    const stage = createStage({
      name: 'Native-only',
      applies: (ctx) => ctx.platform !== 'web',
      execute: async () => {
        executed = true;
        return { ok: true };
      },
    });

    const { result } = await captureConsole(() => runPipeline([stage], { platform: 'web' }));
    assert.equal(executed, false);
    assert.equal(result.ok, true);
    assert.equal(result.timings.length, 0);
  });

  test('a stage result with skipped:true records "Skipped" timing, not a duration', async () => {
    const stage = createStage({ name: 'Cache', execute: async () => ({ ok: true, skipped: true }) });
    const { result } = await captureConsole(() => runPipeline([stage], {}));
    assert.equal(result.timings[0].elapsed, 'Skipped');
  });

  test('summary() rows are collected for successful stages, in order', async () => {
    const a = createStage({ name: 'A', execute: async () => ({ ok: true }), summary: () => [['A-row', '1']] });
    const b = createStage({ name: 'B', execute: async () => ({ ok: true }), summary: () => [['B-row', '2']] });
    const { result } = await captureConsole(() => runPipeline([a, b], {}));
    assert.deepEqual(result.rows, [['A-row', '1'], ['B-row', '2']]);
  });

  test('error() output is not double-collected as summary rows on failure', async () => {
    const stage = createStage({
      name: 'Failing',
      execute: async () => ({ ok: false }),
      summary: () => [['should-not-appear', 'x']],
      error: () => ({ rootCause: 'failed' }),
    });
    const { result } = await captureConsole(() => runPipeline([stage], {}));
    assert.deepEqual(result.rows, []);
  });
});

describe('runPipeline: parallel groups', () => {
  test('stages in an array entry actually run concurrently, not sequentially', async () => {
    const order = [];
    const slow = createStage({
      name: 'Slow',
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        order.push('slow-done');
        return { ok: true };
      },
    });
    const fast = createStage({
      name: 'Fast',
      execute: async () => {
        order.push('fast-done');
        return { ok: true };
      },
    });

    // If these ran sequentially in array order, 'slow-done' would be pushed before 'fast' even
    // starts. Concurrent execution means the fast one finishes first regardless of array order.
    await captureConsole(() => runPipeline([[slow, fast]], {}));
    assert.deepEqual(order, ['fast-done', 'slow-done']);
  });

  test('parallel group output is flushed in stage-declaration order despite finishing out of order', async () => {
    const slow = createStage({
      name: 'Slow',
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        log.ok('slow output');
        return { ok: true };
      },
    });
    const fast = createStage({
      name: 'Fast',
      execute: async () => {
        log.ok('fast output');
        return { ok: true };
      },
    });

    const { lines } = await captureConsole(() => runPipeline([[slow, fast]], {}));
    const slowIndex = lines.findIndex((l) => l.includes('slow output'));
    const fastIndex = lines.findIndex((l) => l.includes('fast output'));
    assert.ok(slowIndex >= 0 && fastIndex >= 0);
    assert.ok(slowIndex < fastIndex, 'Slow was declared first, so its output must print first despite finishing last');
  });

  test('one failing stage in a parallel group still lets its siblings report their own results', async () => {
    const failing = createStage({ name: 'Failing', execute: async () => ({ ok: false, rootCause: 'x' }) });
    const passing = createStage({ name: 'Passing', execute: async () => ({ ok: true }), summary: () => [['ok', 'yes']] });

    const { result } = await captureConsole(() => runPipeline([[failing, passing]], {}));
    assert.equal(result.ok, false);
    assert.equal(result.timings.length, 2, 'both stages in the group should report timing even though one failed');
  });
});

describe('runPipeline: full ctx passthrough', () => {
  test('execute() receives the exact ctx object passed to runPipeline', async () => {
    const ctx = { app: { project: 'customer-app' }, platform: 'android' };
    let received;
    const stage = createStage({
      name: 'Ctx check',
      execute: async (c) => {
        received = c;
        return { ok: true };
      },
    });
    await captureConsole(() => runPipeline([stage], ctx));
    assert.equal(received, ctx);
  });
});
