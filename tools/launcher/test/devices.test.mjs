import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseAdbDevicesOutput, parseSimctlOutput, parseXctraceOutput, filterByProfile } from '../lib/devices.mjs';

describe('parseAdbDevicesOutput', () => {
  test('parses a mix of emulator and physical devices, keeping only "device" state', () => {
    const stdout = [
      'List of devices attached',
      'emulator-5554          device product:sdk_gphone64_x86_64 model:Pixel_9_Pro device:emulator64_x86_64 transport_id:1',
      'R58N30XXXXX             device usb:1-1 product:o1s model:SM_G991B device:o1s transport_id:2',
      '192.168.1.5:5555        offline',
      '',
    ].join('\n');

    const devices = parseAdbDevicesOutput(stdout);
    assert.equal(devices.length, 2);
    assert.equal(devices[0].id, 'emulator-5554');
    assert.equal(devices[0].isEmulator, true);
    assert.equal(devices[0].name, 'Pixel 9 Pro');
    assert.equal(devices[0].kind, 'android');
    assert.equal(devices[1].id, 'R58N30XXXXX');
    assert.equal(devices[1].isEmulator, false);
  });

  test('empty device list returns an empty array', () => {
    assert.deepEqual(parseAdbDevicesOutput('List of devices attached\n\n'), []);
  });

  test('a device with no model: field falls back to its id as the name', () => {
    const stdout = 'List of devices attached\nemulator-5556          device transport_id:3\n';
    const devices = parseAdbDevicesOutput(stdout);
    assert.equal(devices[0].name, 'emulator-5556');
  });
});

describe('parseSimctlOutput', () => {
  test('parses available simulators across runtimes, skipping unavailable ones', () => {
    const stdout = JSON.stringify({
      devices: {
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
          { udid: 'AAAA', name: 'iPhone 15', state: 'Booted', isAvailable: true },
          { udid: 'BBBB', name: 'iPhone SE (3rd generation)', state: 'Shutdown', isAvailable: true },
          { udid: 'CCCC', name: 'iPad (unavailable runtime)', state: 'Shutdown', isAvailable: false },
        ],
      },
    });

    const devices = parseSimctlOutput(stdout);
    assert.equal(devices.length, 2);
    assert.equal(devices[0].kind, 'ios-simulator');
    assert.equal(devices[0].isEmulator, true);
    assert.ok(devices.every((d) => d.id !== 'CCCC'));
  });

  test('malformed JSON returns an empty array instead of throwing', () => {
    assert.doesNotThrow(() => parseSimctlOutput('not json'));
    assert.deepEqual(parseSimctlOutput('not json'), []);
  });
});

describe('parseXctraceOutput', () => {
  test('parses physical devices from the Devices section, stops at Simulators', () => {
    const stdout = [
      '== Devices ==',
      "Hari's iPhone (18.1) (00008030-000C1D2E3F4A5B6C)",
      'My Mac (16.1) (00008103-0011AABBCCDDEEFF)',
      '== Simulators ==',
      'iPhone 15 (17.0) (SIMULATOR-UDID-SHOULD-NOT-APPEAR)',
    ].join('\n');

    const devices = parseXctraceOutput(stdout);
    assert.equal(devices.length, 2);
    assert.equal(devices[0].id, '00008030-000C1D2E3F4A5B6C');
    assert.equal(devices[0].name, "Hari's iPhone");
    assert.equal(devices[0].kind, 'ios-physical');
    assert.ok(devices.every((d) => d.id !== 'SIMULATOR-UDID-SHOULD-NOT-APPEAR'));
  });

  test('no Devices section returns an empty array', () => {
    assert.deepEqual(parseXctraceOutput('== Simulators ==\niPhone 15 (17.0) (UDID)\n'), []);
  });
});

describe('filterByProfile', () => {
  const devices = [
    { name: 'Pixel 9', isEmulator: true, kind: 'android' },
    { name: 'Galaxy S24', isEmulator: false, kind: 'android' },
  ];

  test('no profile returns the full list unchanged', () => {
    assert.deepEqual(filterByProfile(devices, null), devices);
  });

  test('a matching profile narrows the list', () => {
    const pixelOnly = filterByProfile(devices, { name: 'pixel', label: 'Pixel', match: (d) => /pixel/i.test(d.name) });
    assert.equal(pixelOnly.length, 1);
    assert.equal(pixelOnly[0].name, 'Pixel 9');
  });

  test('a profile matching nothing falls back to the full list (never zero candidates)', () => {
    const noMatch = filterByProfile(devices, { name: 'fold', label: 'Fold', match: (d) => /fold/i.test(d.name) });
    assert.deepEqual(noMatch, devices);
  });
});
