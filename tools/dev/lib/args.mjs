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

  return {
    // 'none' (matching Bootstrap v5's `-FrontendApp none`) means "prepare the backend/deps only,
    // don't launch an Angular app" — handled by bootstrap.mjs, never passed to registry.resolveApp.
    appAlias: positional[0] ?? 'customer',
    // First-time only: install frontend+backend deps, scaffold apps/api-gateway/.env if missing,
    // and run backend Prisma migrations. Never implied by the other flags — see Bootstrap v5's own
    // documented lesson ("Do not automatically run migrations or seeds during daily startup").
    setup: !!flags.setup,
    // Prepare backend/infrastructure only; skip launching a frontend app even if appAlias isn't 'none'.
    backendOnly: !!flags['backend-only'],
    // Skip Docker/infrastructure entirely — for someone already running it another way, or pointed
    // at a remote environment via the frontend launcher's own --env flag afterward.
    skipInfrastructure: !!flags['skip-infrastructure'],
    verbose: !!flags.verbose,
  };
}
