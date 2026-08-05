/** Parses the launcher CLI's argv (already sliced past `node cli.mjs`) into a plain options
 *  object. Extracted from cli.mjs so it's testable without executing the whole CLI (which would
 *  need process.exit/console mocking just to check flag parsing). Pure function: no I/O, no
 *  process.env, no process.exit — same input always produces the same output. */
export function parseArgs(argv) {
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
    appAlias: positional[0],
    platform: positional[1],
    env: flags.env ?? 'local',
    verbose: !!flags.verbose,
    noBuild: !!flags['no-build'],
    noSync: !!flags['no-sync'],
    noBackendStart: !!flags['no-backend-start'],
    open: !!flags.open,
    device: typeof flags.device === 'string' ? flags.device : null,
    emulator: !!flags.emulator,
    browser: !!flags.browser,
    clean: !!flags.clean,
    watch: !!flags.watch,
    profile: typeof flags.profile === 'string' ? flags.profile : null,
  };
}
