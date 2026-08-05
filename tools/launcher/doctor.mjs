#!/usr/bin/env node
// Task 3 — `pnpm doctor`. Unlike the launcher (which validates one app+platform+env and stops at
// the first failure), doctor never stops early — it's a full diagnostic sweep across every app,
// every tool, and the backend, meant to answer "what, across this whole workspace, needs my
// attention" in one run. Read-only: it never auto-starts the backend (passes noBackendStart:true
// unconditionally) — a diagnostic command shouldn't have side effects the developer didn't ask for.
import * as log from './lib/log.mjs';
import { APPS, resolveEnvironment } from './lib/registry.mjs';
import { buildToolChecks, buildAppChecks, runChecks } from './lib/validate-environment.mjs';
import { detectBackend } from './lib/detect-backend.mjs';

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function runSection(name, fn) {
  const timer = new log.StepTimer();
  const { result, lines } = await log.runCaptured(fn);
  log.flush(lines);
  return { name, result, elapsed: timer.elapsed() };
}

async function main() {
  const verbose = hasFlag('verbose');
  log.setVerbose(verbose);

  console.log(`\nPatheya Express — Doctor\n${'─'.repeat(50)}`);
  const overallStart = performance.now();

  // Every section is independent of every other (Task 4) — Development Tools doesn't need to
  // know if the Customer App's config is broken, and vice versa — so they all run concurrently,
  // each buffered and flushed in a fixed order afterward (same reasoning as pipeline.mjs's
  // parallel groups: real concurrency, readable sequential-looking output).
  const toolsSection = runSection('Development Tools', async () => {
    log.section('Development Tools');
    return runChecks(buildToolChecks({ platform: 'all' }));
  });

  const appSections = Object.entries(APPS).map(([alias, app]) =>
    runSection(`${app.displayName}`, async () => {
      log.section(`${app.displayName} Configuration`);
      return runChecks(buildAppChecks({ app: { alias, ...app }, platform: 'all', envName: 'local' }));
    }),
  );

  const backendSection = runSection('Backend', async () => {
    const environment = resolveEnvironment('local');
    // Any app works here — they all resolve the same local API base URL (localhost:3000).
    const app = { alias: 'customer', ...APPS.customer };
    const result = await detectBackend({
      app,
      environment,
      envName: 'local',
      verbose,
      noBackendStart: true,
      sectionTitle: 'Backend (local)',
    });
    // detectBackend's shape doesn't carry checks/failed/warnings like the check-based sections —
    // normalize it to the same {ok, failed, warnings} shape so the summary counts below are simple.
    return { ok: result.ok, checks: [], failed: result.ok ? [] : [{ label: 'Backend', ...result }], warnings: [] };
  });

  const sections = await Promise.all([toolsSection, ...appSections, backendSection]);

  const totalFailed = sections.reduce((sum, s) => sum + s.result.failed.length, 0);
  const totalWarnings = sections.reduce((sum, s) => sum + s.result.warnings.length, 0);
  const totalPassed = sections.reduce((sum, s) => sum + (s.result.checks.length - s.result.failed.length - s.result.warnings.length), 0);
  const totalElapsed = log.formatDuration(performance.now() - overallStart);

  log.printTimingBreakdown(
    sections.map((s) => ({ name: s.name, elapsed: s.elapsed })),
    totalElapsed,
  );

  log.printDashboard({
    title: 'Doctor Summary',
    rows: [
      ['Passed', totalPassed],
      ['Warnings', totalWarnings],
      ['Failed', totalFailed],
      ...sections.map((s) => [s.name, s.result.ok ? (s.result.warnings.length > 0 ? 'Degraded' : 'Healthy') : 'Failed']),
      ['Total Time', totalElapsed],
    ],
    footer: totalFailed === 0 ? 'No blocking issues found.' : `${totalFailed} issue${totalFailed === 1 ? '' : 's'} need attention — see ✖ items above.`,
  });

  if (totalFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  log.failWithGuidance({
    rootCause: 'Doctor hit an unexpected internal error.',
    suggestedFix: 'Re-run with --verbose for the full error.',
    error,
    verbose: process.argv.includes('--verbose'),
  });
  process.exitCode = 1;
});
