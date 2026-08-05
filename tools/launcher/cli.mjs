#!/usr/bin/env node
import * as log from './lib/log.mjs';
import { APPS, resolveApp, resolveEnvironment, resolveProfile, LauncherError } from './lib/registry.mjs';
import { runPipeline } from './lib/pipeline.mjs';
import { buildPipeline } from './lib/stages.mjs';
import { resolveLaunch } from './lib/launch.mjs';
import { parseArgs } from './lib/args.mjs';

function printUsage() {
  console.log(`
Usage: node tools/launcher/cli.mjs <app> <platform> [options]

  app       ${Object.keys(APPS).join(' | ')}
  platform  web | android | ios

Options:
  --env=<local|qa|staging|production>   Target environment (default: local)
  --no-build                            Skip the build-verification step
  --no-sync                             Skip Capacitor sync (android/ios)
  --no-backend-start                    Never auto-start the local backend, just validate/wait
  --open                                Open the browser (web) / IDE (android/ios)
  --device=<id>                         Launch directly to a specific device/emulator/simulator
  --profile=<name>                      Prefer a named device profile when selecting a target
                                         (pixel, tablet, fold, emulator, iphone, ipad, simulator, physical)
  --emulator                            Prefer a running emulator when selecting an Android target
  --browser                             Open the system browser once the web dev server is ready
  --clean                               Force a Capacitor resync, ignoring the change-detection cache
  --watch                               (web: no-op, already watching) (native: see note in README)
  --verbose                             Show full error output and DEBUG/TRACE logs

Examples:
  node tools/launcher/cli.mjs customer web
  node tools/launcher/cli.mjs customer web --env=qa --browser
  node tools/launcher/cli.mjs customer android --profile=pixel
  node tools/launcher/cli.mjs partner ios --device=00008030-000C1D2E3F4G5H6I

Also see: pnpm doctor — full diagnostic report across all tooling, apps, and environments.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  log.setVerbose(args.verbose);

  if (!args.appAlias || !args.platform) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const overallStart = performance.now();

  let app;
  let environment;
  let profile;
  try {
    app = resolveApp(args.appAlias);
    environment = resolveEnvironment(args.env);
    profile = resolveProfile(args.profile);
  } catch (error) {
    if (error instanceof LauncherError) {
      log.failWithGuidance({ rootCause: error.rootCause, suggestedFix: error.suggestedFix, docs: error.docs, error });
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  if (!['web', 'android', 'ios'].includes(args.platform)) {
    log.failWithGuidance({ rootCause: `Unknown platform "${args.platform}".`, suggestedFix: 'Use one of: web, android, ios.' });
    process.exitCode = 1;
    return;
  }

  if (!app.platforms[args.platform]) {
    const supported = Object.entries(app.platforms).filter(([, enabled]) => enabled).map(([p]) => p);
    log.failWithGuidance({
      rootCause: `${app.displayName} does not support "${args.platform}".`,
      suggestedFix: `Supported platforms: ${supported.join(', ')}.`,
      nextAction: `node tools/launcher/cli.mjs ${args.appAlias} ${supported[0]}`,
    });
    process.exitCode = 1;
    return;
  }

  if (!app.environments.includes(args.env)) {
    log.failWithGuidance({
      rootCause: `${app.displayName} does not support the "${args.env}" environment.`,
      suggestedFix: `Supported: ${app.environments.join(', ')}.`,
    });
    process.exitCode = 1;
    return;
  }

  console.log(`\n${app.displayName} · ${args.platform} · ${environment.label}\n${'─'.repeat(50)}`);

  const ctx = {
    app,
    platform: args.platform,
    envName: args.env,
    environment,
    verbose: args.verbose,
    noBuild: args.noBuild,
    noSync: args.noSync,
    noBackendStart: args.noBackendStart,
    clean: args.clean,
    profile,
    options: args,
  };

  const pipelineResult = await runPipeline(buildPipeline(), ctx);

  if (!pipelineResult.ok) {
    process.exitCode = 1;
    return;
  }

  // Resolve (fast: device/browser/IDE detection + selection) before printing the dashboard, then
  // invoke (slow: the actual blocking nx serve/cap run/cap open) after — see launch.mjs's doc
  // comment for why launch isn't folded into the pipeline above like the other stages.
  const { targetLabel, invoke } = await resolveLaunch(ctx);

  const setupElapsed = log.formatDuration(performance.now() - overallStart);
  log.printTimingBreakdown(pipelineResult.timings, setupElapsed);
  log.printDashboard({
    title: 'Patheya Express Launcher',
    rows: [
      ['Application', app.displayName],
      ['Platform', args.platform],
      ['Environment', environment.label],
      ...pipelineResult.rows,
      ...(targetLabel ? [['Device', targetLabel]] : []),
      ['Setup Time', setupElapsed],
    ],
    footer: 'Everything ready — launching now.',
  });

  const launchResult = await invoke(ctx);

  if (!launchResult.ok) {
    console.log();
    if (launchResult.rootCause) {
      log.failWithGuidance({ ...launchResult, verbose: args.verbose });
    } else {
      log.fail(`Launch exited with code ${launchResult.code}.`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  log.failWithGuidance({
    rootCause: 'The launcher hit an unexpected internal error.',
    suggestedFix: 'Re-run with --verbose for the full error, and check tools/launcher/README.md.',
    error,
    verbose: process.argv.includes('--verbose'),
  });
  process.exitCode = 1;
});
