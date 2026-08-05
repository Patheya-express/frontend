import { createStage } from './pipeline.mjs';
import { validateEnvironment } from './validate-environment.mjs';
import { detectBackend } from './detect-backend.mjs';
import { verifyBuild } from './verify-build.mjs';
import { syncNative } from './sync-native.mjs';

/**
 * The five existing step modules wrapped as pipeline Stages (Task 8) — none of their own logic
 * changed to fit this shape; only this adapter layer and cli.mjs's orchestration are new. Adding
 * a future stage means adding one more createStage() call to buildStages()'s return array; nothing
 * about runPipeline() or cli.mjs's call to it needs to change for that.
 */

export const environmentStage = createStage({
  name: 'Environment',
  execute: (ctx) => validateEnvironment({ app: ctx.app, platform: ctx.platform, envName: ctx.envName }),
  // validate-environment.mjs already prints every individual check as it runs — the stage-level
  // error() is deliberately just a one-line wrap-up, not a repeat of each check's own guidance.
  error: (result) => ({
    rootCause: `Environment validation failed (${result.failed.length} problem${result.failed.length === 1 ? '' : 's'}).`,
    suggestedFix: 'Fix the ✖ items above and re-run.',
    retryHint: 'Warnings (⚠) do not block launch; only ✖ items do.',
  }),
});

export const backendStage = createStage({
  name: 'Backend',
  execute: (ctx) =>
    detectBackend({
      app: ctx.app,
      environment: ctx.environment,
      envName: ctx.envName,
      verbose: ctx.verbose,
      noBackendStart: ctx.noBackendStart,
    }),
  summary: (result) => {
    if (!result.body) {
      return [['Backend', 'Healthy']];
    }
    const rows = [
      ['Backend', 'Healthy'],
      ['Database', result.body.database],
      ['Redis', result.body.redis],
      ['BullMQ', result.body.queues],
    ];
    if (result.body.websocket !== 'not_applicable') {
      rows.push(['Socket.IO', result.body.websocket]);
    }
    return rows;
  },
  error: (result) => result,
});

export const buildStage = createStage({
  name: 'Build',
  applies: (ctx) => ctx.platform !== 'web',
  execute: (ctx) => verifyBuild({ app: ctx.app, noBuild: ctx.noBuild, verbose: ctx.verbose }),
  summary: (result) => (result.skipped ? [] : [['Build Cache', result.cacheHit ? 'Hit' : 'Miss']]),
  error: (result) => result,
});

export const syncStage = createStage({
  name: 'Capacitor Sync',
  applies: (ctx) => ctx.platform !== 'web',
  execute: (ctx) => syncNative({ app: ctx.app, platform: ctx.platform, noSync: ctx.noSync, clean: ctx.clean, verbose: ctx.verbose }),
  summary: (result) => [['Capacitor Sync', result.skipped ? 'Skipped' : 'Synced']],
  error: (result) => result,
});

/**
 * Task 4 — the returned structure groups Environment+Backend as one parallel entry (both are
 * independent of each other: neither needs the other's result to run) and keeps Build → Sync
 * sequential after them, since Sync genuinely depends on Build having succeeded. Launch
 * deliberately isn't a pipeline stage here — see launch.mjs's doc comment: it's a resolve/invoke
 * split instead, so the dashboard can print with a real resolved device before handing off to a
 * long-running process that won't return until the user stops it.
 */
export function buildPipeline() {
  return [[environmentStage, backendStage], buildStage, syncStage];
}
