import { APPS } from '../../launcher/lib/registry.mjs';

/** Parses `tools/dev/bootstrap.mjs`'s argv (already sliced past `node bootstrap.mjs`) into a plain
 *  options object. Pure function — no I/O, no process.exit — mirrors tools/launcher/lib/args.mjs's
 *  shape/reasoning exactly, so anyone who already knows the launcher's CLI conventions recognizes
 *  this one immediately instead of learning a second dialect. */
export function parseDevArgs(argv) {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const flags = {};

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }
    const [rawKey, rawValue] = arg.slice(2).split('=');
    flags[rawKey] = rawValue ?? true;
  }

  // `pnpm run dev customer-app,delivery-app` and `pnpm run dev customer-app delivery-app` both
  // arrive here (pnpm forwards everything after the script name as separate argv entries), so
  // every positional is split on commas and the result de-duplicated in first-seen order.
  // Validation/normalization is resolveDevApps()'s job, not this parser's.
  const selections = [...new Set(positional.flatMap((arg) => arg.split(',')).map((name) => name.trim()).filter(Boolean))];

  return {
    // 'none' (matching Bootstrap v5's `-FrontendApp none`) means "prepare the backend/deps only,
    // don't launch an Angular app" — handled by resolveDevApps(), never passed to registry.resolveApp.
    appSelections: selections.length > 0 ? selections : ['customer'],
    // First-time only: install frontend+backend deps, scaffold apps/api-gateway/.env if missing,
    // and run backend Prisma migrations. Never implied by the other flags — see Bootstrap v5's own
    // documented lesson ("Do not automatically run migrations or seeds during daily startup").
    setup: !!flags.setup,
    // Prepare backend/infrastructure only; skip launching a frontend app even if apps were selected.
    backendOnly: !!flags['backend-only'],
    // Skip Docker/infrastructure entirely — for someone already running it another way, or pointed
    // at a remote environment via the frontend launcher's own --env flag afterward.
    skipInfrastructure: !!flags['skip-infrastructure'],
    verbose: !!flags.verbose,
  };
}

/** Developer-facing names are the Nx project names (customer-app, restaurant-app, ...), read from
 *  registry.mjs's APPS[*].project — not a second hand-maintained mapping table. */
export const DEV_APP_NAMES = Object.values(APPS).map((app) => app.project);

/**
 * Normalizes parseDevArgs().appSelections to launcher aliases (APPS keys: customer, partner, ...).
 * Accepts the Nx project names above, plus — for backward compatibility with `pnpm run setup`,
 * `pnpm run dev:backend-only` and direct `node tools/dev/bootstrap.mjs partner` invocations — the
 * launcher aliases themselves and the special "none" (only on its own). Duplicates collapse after
 * normalization (`customer-app,customer` is one app), preserving first-seen order. Never partially
 * succeeds: any unrecognized name is returned in `invalid` so the caller can fail before launching
 * anything.
 */
export function resolveDevApps(selections) {
  if (selections.length === 1 && selections[0] === 'none') {
    return { aliases: [], invalid: [] };
  }

  const aliases = [];
  const invalid = [];
  for (const name of selections) {
    const alias = Object.hasOwn(APPS, name) ? name : Object.keys(APPS).find((key) => APPS[key].project === name);
    if (!alias) {
      invalid.push(name);
    } else if (!aliases.includes(alias)) {
      aliases.push(alias);
    }
  }
  return { aliases, invalid };
}
