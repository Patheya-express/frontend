import * as log from './log.mjs';
import { runInherit } from './exec.mjs';
import { repoRoot } from './registry.mjs';
import { listAndroidDevices, listIosSimulators, listIosPhysicalDevices, promptDeviceSelection, filterByProfile } from './devices.mjs';

/**
 * Launching is split into resolve (fast: figure out which device/browser/IDE this run targets)
 * and invoke (slow: the actual blocking `nx serve`/`cap run`/`cap open`, streamed to the user).
 * The split exists so the dashboard (Task 7) can report the real resolved Device before handing
 * off to a process that won't return until the user stops it — printing the dashboard *after*
 * invoke() would mean it only appears once the dev server/app is closed, defeating its purpose.
 */

async function resolveWeb({ options }) {
  return { targetLabel: 'Browser', invoke: (ctx) => runWeb(ctx, options) };
}

async function runWeb({ app, environment }, options) {
  log.section('Step 5 — Launch (web)');
  log.ok(`Starting Angular dev server for ${app.displayName}…`);

  const args = ['run', `${app.project}:serve`];
  if (environment.configuration) {
    args.push(`--configuration=${environment.configuration}`);
  }
  if (options.browser) {
    args.push('--open');
  }

  const result = await runInherit('npx', ['nx', ...args], { cwd: repoRoot });
  return { ok: result.code === 0 || result.code === null, code: result.code };
}

async function resolveAndroid({ app, options, profile }) {
  const appCwd = `apps/${app.project}`;

  if (options.open) {
    return { targetLabel: 'Android Studio', invoke: () => runInherit('npx', ['cap', 'open', 'android'], { cwd: `${repoRoot}/${appCwd}` }) };
  }

  if (options.device) {
    return { targetLabel: options.device, invoke: () => runCapRun('android', options.device, appCwd) };
  }

  const devices = await listAndroidDevices();
  if (devices.length === 0) {
    log.warn('No connected devices or running emulators detected.');
    log.detail('Opening Android Studio so you can start an emulator, or connect a device and re-run.');
    return { targetLabel: 'Android Studio', invoke: () => runInherit('npx', ['cap', 'open', 'android'], { cwd: `${repoRoot}/${appCwd}` }) };
  }

  log.ok(`Android device${devices.length > 1 ? 's' : ''} detected.`);
  let candidates = filterByProfile(devices, profile);
  if (options.emulator) {
    const emulatorsOnly = candidates.filter((d) => d.isEmulator);
    if (emulatorsOnly.length === 0) {
      log.warn('--emulator was set but no running emulator was found among the candidates.');
    } else {
      candidates = emulatorsOnly;
    }
  }

  const targetId = await promptDeviceSelection(candidates, 'Android device');
  const targetLabel = candidates.find((d) => d.id === targetId)?.name ?? targetId;
  return { targetLabel, invoke: () => runCapRun('android', targetId, appCwd) };
}

async function resolveIos({ app, options, profile }) {
  const appCwd = `apps/${app.project}`;

  if (process.platform !== 'darwin') {
    return {
      targetLabel: null,
      invoke: async () => ({
        ok: false,
        rootCause: 'iOS launch requires macOS.',
        suggestedFix: 'Run this command on a Mac, or target web/android instead.',
      }),
    };
  }

  if (options.open) {
    return { targetLabel: 'Xcode', invoke: () => runInherit('npx', ['cap', 'open', 'ios'], { cwd: `${repoRoot}/${appCwd}` }) };
  }

  if (options.device) {
    return { targetLabel: options.device, invoke: () => runCapRun('ios', options.device, appCwd) };
  }

  const [physical, simulators] = await Promise.all([listIosPhysicalDevices(), listIosSimulators()]);
  const candidates = [...physical, ...simulators.filter((s) => s.state === 'Booted'), ...simulators.filter((s) => s.state !== 'Booted')];

  if (candidates.length === 0) {
    log.warn('No connected iPhones or available simulators detected.');
    log.detail('Opening Xcode so you can start a simulator, or connect a device and re-run.');
    return { targetLabel: 'Xcode', invoke: () => runInherit('npx', ['cap', 'open', 'ios'], { cwd: `${repoRoot}/${appCwd}` }) };
  }

  log.ok(`iOS device${candidates.length > 1 ? 's' : ''}/simulator${candidates.length > 1 ? 's' : ''} detected.`);
  const filtered = filterByProfile(candidates, profile);
  const targetId = await promptDeviceSelection(filtered, 'iOS device/simulator');
  const targetLabel = filtered.find((d) => d.id === targetId)?.name ?? targetId;
  return { targetLabel, invoke: () => runCapRun('ios', targetId, appCwd) };
}

async function runCapRun(platform, targetId, appCwd) {
  log.section(`Step 5 — Launch (${platform === 'android' ? 'Android' : 'iOS'})`);
  log.ok(`Launching to ${targetId}…`);
  const result = await runInherit('npx', ['cap', 'run', platform, '--target', targetId], { cwd: `${repoRoot}/${appCwd}` });
  return { ok: result.code === 0, code: result.code };
}

/**
 * Resolves what Step 5 will target (device/browser/IDE) without yet running the blocking launch
 * command — see the module doc comment above for why. Returns { targetLabel, invoke }; the caller
 * (cli.mjs) is responsible for calling invoke() once it's done anything that needs targetLabel
 * (i.e. printing the dashboard).
 */
export async function resolveLaunch(ctx) {
  if (ctx.platform === 'web') {
    return resolveWeb(ctx);
  }
  if (ctx.platform === 'android') {
    return resolveAndroid(ctx);
  }
  return resolveIos(ctx);
}
