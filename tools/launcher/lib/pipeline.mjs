import * as log from './log.mjs';

/**
 * Task 8 — pipeline/stage architecture. A Stage is a plain object exposing:
 *   - name: string
 *   - applies(ctx): boolean          — should this stage run at all for this ctx? (e.g. the
 *                                       Build/Sync/Launch-native stages don't apply to `web`)
 *   - execute(ctx): Promise<Result>  — does the work; Result is whatever shape the underlying
 *                                       step module already returns ({ok, ...})
 *   - summary(result): {label, value}[]  — dashboard/timing-friendly rows for a *successful* result
 *   - error(result): {rootCause, suggestedFix, nextAction, docs, retryHint}  — guidance for a
 *                                       *failed* result, in log.failWithGuidance's shape
 *
 * This is an internal restructuring only (Task 8 is explicit: "no behaviour changes") — every
 * stage below wraps an existing step module (validate-environment.mjs, detect-backend.mjs, etc.)
 * verbatim; none of their own logic changed to fit this shape, only cli.mjs's orchestration did.
 * Adding a future stage means adding one object to the array passed to runPipeline() — the
 * orchestrator itself never special-cases a stage by name.
 */
export function createStage({ name, applies = () => true, execute, summary = () => [], error }) {
  return { name, applies, execute, summary, error };
}

/**
 * Runs `entries` in order, where each entry is either a single Stage or an array of Stages to run
 * concurrently (Task 4 — "respect dependencies, don't parallelise dependent steps": the caller
 * decides what's independent by grouping those stages into one array entry; runPipeline itself
 * has no opinion on which stages are safe to parallelize).
 *
 * Stops at the first entry containing a failed, halting stage (haltOnFailure, default true) —
 * matching the CLI's existing "print guidance, stop" behavior exactly. A stage whose `applies()`
 * returns false is skipped entirely (not run, not reported as failed) — this is how the
 * build/sync stages opt out for `web`, and how android/ios-only validation checks opt out for the
 * other platform, without the orchestrator needing to know why.
 */
export async function runPipeline(entries, ctx) {
  const timings = [];
  const rows = [];
  let overallOk = true;

  for (const entry of entries) {
    const stages = Array.isArray(entry) ? entry : [entry];
    const applicable = stages.filter((stage) => stage.applies(ctx));

    if (applicable.length === 0) {
      continue;
    }

    // A single-stage entry prints directly (no concurrency, no ordering risk). A multi-stage
    // (genuinely parallel) entry buffers each stage's output via log.runCaptured and flushes it
    // in stage-declaration order once every stage in the group finishes — otherwise their
    // interleaved console output would be unreadable (see log.mjs's doc comment on this).
    const isParallelGroup = applicable.length > 1;
    const started = applicable.map((stage) => ({ stage, timer: new log.StepTimer() }));
    const outcomes = await Promise.all(
      started.map(({ stage }) => (isParallelGroup ? log.runCaptured(() => stage.execute(ctx)) : stage.execute(ctx).then((result) => ({ result, lines: null })))),
    );

    if (isParallelGroup) {
      for (const outcome of outcomes) {
        log.flush(outcome.lines);
      }
    }

    const results = outcomes.map((outcome) => outcome.result);

    let entryFailed = false;

    for (let i = 0; i < applicable.length; i++) {
      const stage = applicable[i];
      const result = results[i];
      const elapsed = started[i].timer.elapsed();

      if (result?.skipped) {
        timings.push({ name: stage.name, elapsed: 'Skipped' });
        rows.push(...stage.summary(result));
        continue;
      }

      timings.push({ name: stage.name, elapsed });

      if (!result?.ok) {
        entryFailed = true;
        const guidance = stage.error ? stage.error(result) : { rootCause: `${stage.name} failed.` };
        log.failWithGuidance({ ...guidance, error: result?.error, verbose: log.isVerbose() });
      } else {
        rows.push(...stage.summary(result));
      }
    }

    if (entryFailed) {
      overallOk = false;
      break;
    }
  }

  return { ok: overallOk, timings, rows };
}
