import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../lib/args.mjs';

describe('parseArgs', () => {
  test('reads positional app and platform', () => {
    const args = parseArgs(['customer', 'android']);
    assert.equal(args.appAlias, 'customer');
    assert.equal(args.platform, 'android');
  });

  test('defaults env to local when --env is absent', () => {
    const args = parseArgs(['customer', 'web']);
    assert.equal(args.env, 'local');
  });

  test('parses --env=value', () => {
    const args = parseArgs(['customer', 'web', '--env=qa']);
    assert.equal(args.env, 'qa');
  });

  test('boolean flags default false and flip true when present', () => {
    const defaults = parseArgs(['customer', 'web']);
    assert.equal(defaults.verbose, false);
    assert.equal(defaults.clean, false);
    assert.equal(defaults.emulator, false);

    const flagged = parseArgs(['customer', 'web', '--verbose', '--clean', '--emulator']);
    assert.equal(flagged.verbose, true);
    assert.equal(flagged.clean, true);
    assert.equal(flagged.emulator, true);
  });

  test('--device=<id> is captured as a string; absent is null', () => {
    assert.equal(parseArgs(['customer', 'android']).device, null);
    assert.equal(parseArgs(['customer', 'android', '--device=emulator-5554']).device, 'emulator-5554');
  });

  test('--profile=<name> is captured as a string; absent is null', () => {
    assert.equal(parseArgs(['customer', 'android']).profile, null);
    assert.equal(parseArgs(['customer', 'android', '--profile=pixel']).profile, 'pixel');
  });

  test('order of flags does not matter', () => {
    const a = parseArgs(['customer', 'android', '--env=qa', '--profile=pixel', '--verbose']);
    const b = parseArgs(['customer', 'android', '--verbose', '--profile=pixel', '--env=qa']);
    assert.deepEqual(a, b);
  });

  test('unknown flags are ignored rather than throwing', () => {
    assert.doesNotThrow(() => parseArgs(['customer', 'web', '--totally-unknown-flag']));
  });

  test('missing app/platform leaves them undefined (cli.mjs prints usage for this case)', () => {
    const args = parseArgs([]);
    assert.equal(args.appAlias, undefined);
    assert.equal(args.platform, undefined);
  });
});
