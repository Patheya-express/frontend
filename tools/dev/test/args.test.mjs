import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseDevArgs } from '../lib/args.mjs';

describe('parseDevArgs', () => {
  test('defaults appAlias to "customer" when no positional arg is given', () => {
    assert.equal(parseDevArgs([]).appAlias, 'customer');
  });

  test('reads a positional app alias, including the special "none"', () => {
    assert.equal(parseDevArgs(['partner']).appAlias, 'partner');
    assert.equal(parseDevArgs(['none']).appAlias, 'none');
  });

  test('boolean flags default false and flip true when present', () => {
    const defaults = parseDevArgs(['customer']);
    assert.equal(defaults.setup, false);
    assert.equal(defaults.backendOnly, false);
    assert.equal(defaults.skipInfrastructure, false);
    assert.equal(defaults.verbose, false);

    const flagged = parseDevArgs(['customer', '--setup', '--backend-only', '--skip-infrastructure', '--verbose']);
    assert.equal(flagged.setup, true);
    assert.equal(flagged.backendOnly, true);
    assert.equal(flagged.skipInfrastructure, true);
    assert.equal(flagged.verbose, true);
  });

  test('order of flags does not matter', () => {
    const a = parseDevArgs(['customer', '--setup', '--verbose']);
    const b = parseDevArgs(['customer', '--verbose', '--setup']);
    assert.deepEqual(a, b);
  });

  test('unknown flags are ignored rather than throwing', () => {
    assert.doesNotThrow(() => parseDevArgs(['customer', '--totally-unknown-flag']));
  });

  test('flags-only invocation (no positional app) still defaults to customer', () => {
    const args = parseDevArgs(['--setup']);
    assert.equal(args.appAlias, 'customer');
    assert.equal(args.setup, true);
  });
});
