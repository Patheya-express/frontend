import { createInterface } from 'node:readline/promises';
import { runCapture } from './exec.mjs';
import * as log from './log.mjs';

/**
 * Pure parsers, deliberately separated from the process-spawning functions below them (Task 13:
 * testable without mocking `adb`/`xcrun` or requiring a real device — feed these sample command
 * output directly).
 */

/** Parses `adb devices -l` stdout into { id, state, model, name, isEmulator, kind }[]. Skips the
 *  header line and any device not in "device" state (offline/unauthorized devices can't actually
 *  be launched to). */
export function parseAdbDevicesOutput(stdout) {
  const lines = stdout.split('\n').slice(1); // drop "List of devices attached"
  const devices = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    const [id, state, ...rest] = parts;
    const modelField = rest.find((part) => part.startsWith('model:'));
    devices.push({
      id,
      state,
      model: modelField ? modelField.replace('model:', '') : id,
      name: modelField ? modelField.replace('model:', '').replace(/_/g, ' ') : id,
      isEmulator: id.startsWith('emulator-'),
      kind: 'android',
    });
  }

  return devices.filter((d) => d.state === 'device');
}

/** Parses `xcrun simctl list devices --json` stdout into available simulators. Returns []
 *  (never throws) on malformed JSON — a corrupt/unexpected simctl output should degrade to "no
 *  simulators found", not crash device selection. */
export function parseSimctlOutput(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    const devices = [];
    for (const [runtime, entries] of Object.entries(parsed.devices ?? {})) {
      for (const device of entries) {
        if (device.isAvailable) {
          devices.push({
            id: device.udid,
            name: device.name,
            state: device.state,
            runtime,
            isEmulator: true,
            kind: 'ios-simulator',
          });
        }
      }
    }
    return devices;
  } catch {
    return [];
  }
}

/** Best-effort text parse of `xcrun xctrace list devices` stdout for physically connected
 *  iPhones — unlike simctl's simulator list, there's no JSON output for this one. Format (per
 *  line): "iPhone Name (iOS version) (UDID)" under a "== Devices ==" section, before
 *  "== Simulators ==". */
export function parseXctraceOutput(stdout) {
  const devices = [];
  const lines = stdout.split('\n');
  let inDeviceSection = false;

  for (const line of lines) {
    if (line.includes('== Devices ==')) {
      inDeviceSection = true;
      continue;
    }
    if (line.includes('== Simulators ==')) {
      break;
    }
    if (!inDeviceSection) {
      continue;
    }

    const match = line.match(/^(.+?)\s+\([^)]+\)\s+\(([0-9A-Fa-f-]+)\)\s*$/);
    if (match) {
      devices.push({ id: match[2], name: match[1].trim(), isEmulator: false, kind: 'ios-physical' });
    }
  }

  return devices;
}

export async function listAndroidDevices() {
  const result = await runCapture('adb', ['devices', '-l']);
  return result.error ? [] : parseAdbDevicesOutput(result.stdout);
}

/** macOS only — callers must already have confirmed process.platform === 'darwin' before calling. */
export async function listIosSimulators() {
  const result = await runCapture('xcrun', ['simctl', 'list', 'devices', '--json']);
  return result.error || result.code !== 0 ? [] : parseSimctlOutput(result.stdout);
}

export async function listIosPhysicalDevices() {
  const result = await runCapture('xcrun', ['xctrace', 'list', 'devices']);
  return result.error || result.code !== 0 ? [] : parseXctraceOutput(result.stdout);
}

/**
 * Task 6 — narrows candidates to those matching a named device profile (see registry.mjs's
 * DEVICE_PROFILES) before selection. Falls back to the full candidate list (with a warning) if
 * the profile matches nothing currently connected/available, rather than dead-ending with zero
 * options — a profile is a *preference*, not a hard requirement the launch should fail over.
 */
export function filterByProfile(devices, profile) {
  if (!profile) {
    return devices;
  }
  const matched = devices.filter(profile.match);
  if (matched.length === 0) {
    log.warn(`No connected/available device matches profile "${profile.name}" (${profile.label}) — showing all candidates instead.`);
    return devices;
  }
  return matched;
}

/**
 * Numbered-list device picker over stdin/stdout — no inquirer/enquirer dependency. Auto-selects
 * without prompting when there's exactly one candidate (matches the sprint's "detect available
 * devices, provide interactive selection when multiple exist" — a single device needs no prompt).
 */
export async function promptDeviceSelection(devices, label) {
  if (devices.length === 0) {
    return null;
  }
  if (devices.length === 1) {
    log.info(`Using the only available ${label}: ${devices[0].name ?? devices[0].model ?? devices[0].id}`);
    return devices[0].id;
  }

  console.log(`\nMultiple ${label}s found:`);
  devices.forEach((device, index) => {
    console.log(`  ${index + 1}) ${device.name ?? device.model ?? device.id}${device.isEmulator ? ' (emulator)' : ''}`);
  });

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`Select a ${label} [1-${devices.length}]: `);
    const index = Number.parseInt(answer, 10) - 1;
    if (Number.isNaN(index) || index < 0 || index >= devices.length) {
      log.warn(`Invalid selection — defaulting to the first ${label}.`);
      return devices[0].id;
    }
    return devices[index].id;
  } finally {
    rl.close();
  }
}
