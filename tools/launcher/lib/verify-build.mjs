import * as log from './log.mjs';
import { runInheritCapture } from './exec.mjs';
import { repoRoot } from './registry.mjs';

const CACHE_HIT_PATTERN = /existing outputs match the cache|read the output from the cache/i;

/**
 * Step 3 — build verification. Only meaningful for native targets: `nx serve` (web) compiles on
 * the fly and has no standalone build artifact to check, so the web path skips this step entirely
 * (see cli.mjs). Android/iOS need a real `dist/` output before Capacitor can sync it.
 *
 * Deliberately delegates staleness detection to Nx's own build cache rather than reimplementing
 * it — Nx already hashes inputs and skips re-running an unchanged build (you'll see "existing
 * outputs match the cache" in its own output), which is more correct than a bespoke mtime/hash
 * check here would be. This module just detects that text afterwards to report Cache Hit/Miss on
 * the dashboard — it doesn't drive the caching decision itself.
 */
export async function verifyBuild({ app, noBuild, verbose }) {
  log.section('Step 3 — Build verification');

  if (noBuild) {
    log.warn('Skipped (--no-build).');
    return { ok: true, skipped: true };
  }

  const args = ['run', `${app.project}:build`];
  // Native builds always use the `mobile` configuration (see registry note on native environment
  // scope) regardless of --env — per docs/mobile/CAPACITOR.md, only one mobile-pointed environment
  // file exists today, so this isn't a launcher limitation, it's the actual current architecture.
  args.push('--configuration=mobile');

  const start = performance.now();
  const result = await runInheritCapture('npx', ['nx', ...args], { cwd: repoRoot });
  const elapsed = log.formatDuration(performance.now() - start);
  const cacheHit = CACHE_HIT_PATTERN.test(result.output);

  if (result.code === 0) {
    log.ok(`Build complete (${elapsed}, cache ${cacheHit ? 'hit' : 'miss'}).`);
    return { ok: true, skipped: false, elapsed, cacheHit };
  }

  return {
    ok: false,
    rootCause: `Build failed for ${app.displayName} (exit code ${result.code ?? 'unknown'}).`,
    suggestedFix: 'See the build output above for the actual compiler/bundler error.',
    nextAction: `Re-run in isolation: npx nx run ${app.project}:build --configuration=mobile${verbose ? ' --verbose' : ''}`,
    retryHint: 'Fix the reported compiler/bundler error, then re-run this command.',
    docs: 'docs/mobile/CAPACITOR.md',
  };
}
