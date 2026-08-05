import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPS,
  ENVIRONMENTS,
  DEVICE_PROFILES,
  resolveApp,
  resolveEnvironment,
  resolveProfile,
  resolveApiBaseUrl,
  environmentFilePath,
  LauncherError,
} from '../lib/registry.mjs';

describe('registry: apps', () => {
  test('every declared app resolves to itself plus an alias field', () => {
    for (const alias of Object.keys(APPS)) {
      const app = resolveApp(alias);
      assert.equal(app.alias, alias);
      assert.equal(app.project, APPS[alias].project);
    }
  });

  test('unknown app alias throws LauncherError listing valid options', () => {
    assert.throws(() => resolveApp('nonexistent'), LauncherError);
    try {
      resolveApp('nonexistent');
    } catch (error) {
      assert.match(error.suggestedFix, /customer/);
      assert.match(error.suggestedFix, /admin/);
    }
  });

  test('admin is web-only; the other three support all platforms', () => {
    assert.deepEqual(APPS.admin.platforms, { web: true, android: false, ios: false });
    for (const alias of ['customer', 'partner', 'delivery']) {
      assert.deepEqual(APPS[alias].platforms, { web: true, android: true, ios: true });
    }
  });

  test('every app declares at least one package.json alias', () => {
    for (const app of Object.values(APPS)) {
      assert.ok(Array.isArray(app.aliases) && app.aliases.length > 0);
    }
  });
});

describe('registry: environments', () => {
  test('local has no configuration override (uses Nx/Angular defaults)', () => {
    const env = resolveEnvironment('local');
    assert.equal(env.configuration, null);
    assert.equal(env.isRemote, false);
  });

  test('qa/staging/production are remote with a matching configuration name', () => {
    for (const name of ['qa', 'staging', 'production']) {
      const env = resolveEnvironment(name);
      assert.equal(env.isRemote, true);
      assert.ok(env.configuration);
    }
  });

  test('production maps to the "prod" environment file suffix (not "production")', () => {
    assert.equal(ENVIRONMENTS.production.envFileSuffix, 'prod');
  });

  test('unknown environment throws LauncherError', () => {
    assert.throws(() => resolveEnvironment('nonexistent'), LauncherError);
  });

  test('defaults to local when no name is given', () => {
    assert.equal(resolveEnvironment().name, 'local');
  });
});

describe('registry: device profiles', () => {
  test('resolveProfile(null) returns null (no profile requested)', () => {
    assert.equal(resolveProfile(null), null);
    assert.equal(resolveProfile(undefined), null);
  });

  test('resolveProfile returns a matcher function for every declared profile', () => {
    for (const name of Object.keys(DEVICE_PROFILES)) {
      const profile = resolveProfile(name);
      assert.equal(profile.name, name);
      assert.equal(typeof profile.match, 'function');
    }
  });

  test('unknown profile throws LauncherError', () => {
    assert.throws(() => resolveProfile('nonexistent'), LauncherError);
  });

  test('pixel profile matches Pixel devices case-insensitively, not others', () => {
    const pixel = resolveProfile('pixel');
    assert.equal(pixel.match({ name: 'Pixel 9 Pro' }), true);
    assert.equal(pixel.match({ name: 'pixel_7a' }), true);
    assert.equal(pixel.match({ name: 'iPhone 15' }), false);
  });

  test('emulator profile matches on isEmulator flag, not name', () => {
    const emulator = resolveProfile('emulator');
    assert.equal(emulator.match({ name: 'Anything', isEmulator: true }), true);
    assert.equal(emulator.match({ name: 'Anything', isEmulator: false }), false);
  });

  test('simulator/physical profiles distinguish by kind/isEmulator', () => {
    const simulator = resolveProfile('simulator');
    const physical = resolveProfile('physical');
    const simDevice = { kind: 'ios-simulator', isEmulator: true };
    const physDevice = { kind: 'ios-physical', isEmulator: false };

    assert.equal(simulator.match(simDevice), true);
    assert.equal(simulator.match(physDevice), false);
    assert.equal(physical.match(physDevice), true);
    assert.equal(physical.match(simDevice), false);
  });
});

describe('registry: environment file resolution', () => {
  test('environmentFilePath returns null for local (no per-env file)', () => {
    assert.equal(environmentFilePath('customer-app', 'local'), null);
  });

  test('environmentFilePath resolves the "prod" suffix for production', () => {
    const path = environmentFilePath('customer-app', 'production');
    assert.match(path, /environment\.prod\.ts$/);
  });

  test('resolveApiBaseUrl returns the documented localhost default for local without reading a file', () => {
    assert.equal(resolveApiBaseUrl('customer-app', 'local'), 'http://localhost:3000');
  });

  test('resolveApiBaseUrl reads a real apiBaseUrl out of customer-app\'s actual environment.qa.ts', () => {
    // Deliberately reads the real repo file rather than a fixture — this is exactly what the
    // launcher itself does at runtime, and the whole point of this check is to catch drift if
    // that file's shape ever changes in a way the regex no longer matches.
    const url = resolveApiBaseUrl('customer-app', 'qa');
    assert.ok(url, 'expected a non-null apiBaseUrl for customer-app qa');
    assert.match(url, /^https?:\/\//);
  });

  test('resolveApiBaseUrl returns null for a nonexistent app', () => {
    assert.equal(resolveApiBaseUrl('this-app-does-not-exist', 'qa'), null);
  });
});
