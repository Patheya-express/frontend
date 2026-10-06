import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseDevArgs, resolveDevApps, DEV_APP_NAMES } from '../lib/args.mjs';

/** parseDevArgs + resolveDevApps together — exactly what bootstrap.mjs's main() does with argv. */
function selectApps(argv) {
  return resolveDevApps(parseDevArgs(argv).appSelections);
}

describe('parseDevArgs', () => {
  test('defaults the app selection to "customer" when no positional arg is given', () => {
    assert.deepEqual(parseDevArgs([]).appSelections, ['customer']);
  });

  test('reads a positional app alias, including the special "none"', () => {
    assert.deepEqual(parseDevArgs(['partner']).appSelections, ['partner']);
    assert.deepEqual(parseDevArgs(['none']).appSelections, ['none']);
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
    assert.deepEqual(args.appSelections, ['customer']);
    assert.equal(args.setup, true);
  });

  test('comma-separated and space-separated selections are equivalent', () => {
    assert.deepEqual(parseDevArgs(['customer-app,delivery-app,admin-app']).appSelections, ['customer-app', 'delivery-app', 'admin-app']);
    assert.deepEqual(parseDevArgs(['customer-app', 'delivery-app', 'admin-app']).appSelections, ['customer-app', 'delivery-app', 'admin-app']);
    assert.deepEqual(parseDevArgs(['customer-app,delivery-app', 'admin-app']).appSelections, ['customer-app', 'delivery-app', 'admin-app']);
  });

  test('empty comma segments and a forwarded "--" separator are ignored', () => {
    assert.deepEqual(parseDevArgs(['--', 'customer-app,,delivery-app,']).appSelections, ['customer-app', 'delivery-app']);
  });
});

describe('resolveDevApps (application selection)', () => {
  test('developer-facing names are exactly the four Nx project names', () => {
    assert.deepEqual(DEV_APP_NAMES, ['customer-app', 'restaurant-app', 'delivery-app', 'admin-app']);
  });

  test('no argument defaults to Customer', () => {
    assert.deepEqual(selectApps([]), { aliases: ['customer'], invalid: [] });
  });

  test('each Nx project name maps to its launcher alias', () => {
    assert.deepEqual(selectApps(['customer-app']).aliases, ['customer']);
    assert.deepEqual(selectApps(['restaurant-app']).aliases, ['partner']);
    assert.deepEqual(selectApps(['delivery-app']).aliases, ['delivery']);
    assert.deepEqual(selectApps(['admin-app']).aliases, ['admin']);
  });

  test('customer-app,delivery-app selects exactly those two, in order', () => {
    assert.deepEqual(selectApps(['customer-app,delivery-app']), { aliases: ['customer', 'delivery'], invalid: [] });
  });

  test('all four selects exactly four, in the requested order', () => {
    assert.deepEqual(selectApps(['customer-app,restaurant-app,delivery-app,admin-app']).aliases, ['customer', 'partner', 'delivery', 'admin']);
    assert.deepEqual(selectApps(['admin-app,customer-app']).aliases, ['admin', 'customer']);
  });

  test('duplicates are removed, including a project name and its own alias', () => {
    assert.deepEqual(selectApps(['customer-app,customer-app,delivery-app']).aliases, ['customer', 'delivery']);
    assert.deepEqual(selectApps(['customer-app,customer']).aliases, ['customer']);
  });

  test('invalid names are reported, never silently dropped', () => {
    assert.deepEqual(selectApps(['customer-app,foo']), { aliases: ['customer'], invalid: ['foo'] });
    assert.deepEqual(selectApps(['foo', 'bar']).invalid, ['foo', 'bar']);
    // Inherited Object.prototype keys must not count as apps.
    assert.deepEqual(selectApps(['constructor']).invalid, ['constructor']);
  });

  test('legacy launcher aliases still work (setup script, direct bootstrap invocations)', () => {
    assert.deepEqual(selectApps(['partner']).aliases, ['partner']);
    assert.deepEqual(selectApps(['customer', '--setup']).aliases, ['customer']);
  });

  test('"none" (dev:backend-only) selects no app, and is only valid on its own', () => {
    assert.deepEqual(selectApps(['none', '--backend-only']), { aliases: [], invalid: [] });
    assert.deepEqual(selectApps(['none,customer-app']).invalid, ['none']);
  });
});
