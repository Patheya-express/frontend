import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(__dirname, '..', '..', '..');

/**
 * Declarative single source of truth for every launchable app — every launcher module reads from
 * here instead of hardcoding project names/ports/platform support. Adding a new app (or a new
 * platform for an existing one) is a single entry here, not a hunt through every module.
 *
 * "partner" (not "restaurant") matches the naming already established in docs/mobile/CAPACITOR.md
 * ("the Phase 1 brief referred to the restaurant-facing app as partner-app... it was treated as
 * the partner target throughout") — the underlying Nx project is still `restaurant-app`, only the
 * developer-facing alias differs.
 */
export const APPS = {
  customer: {
    project: 'customer-app',
    displayName: 'Customer App',
    platforms: { web: true, android: true, ios: true },
    environments: ['local', 'qa', 'staging', 'production'],
    defaultPort: 4200,
    aliases: ['customer:web', 'customer:android', 'customer:ios'],
  },
  partner: {
    project: 'restaurant-app',
    displayName: 'Partner App (Restaurant)',
    platforms: { web: true, android: true, ios: true },
    environments: ['local', 'qa', 'staging', 'production'],
    defaultPort: 4201,
    aliases: ['partner:web', 'partner:android', 'partner:ios'],
  },
  delivery: {
    project: 'delivery-app',
    displayName: 'Delivery App',
    platforms: { web: true, android: true, ios: true },
    environments: ['local', 'qa', 'staging', 'production'],
    defaultPort: 4203,
    aliases: ['delivery:web', 'delivery:android', 'delivery:ios'],
  },
  admin: {
    project: 'admin-app',
    displayName: 'Admin App',
    // Web-only by existing design, not a launcher limitation — see docs/mobile/CAPACITOR.md
    // ("admin-app was not touched anywhere — it stays web-only per the brief").
    platforms: { web: true, android: false, ios: false },
    environments: ['local', 'qa', 'staging', 'production'],
    defaultPort: 4202,
    aliases: ['admin:web'],
  },
};

/**
 * `configuration: null` means "Angular/Nx's own default" (development) — deliberately not the
 * string "development", so a missing/unrecognized --env can't silently pass through as a real
 * configuration name (see resolveEnvironment()'s explicit validation).
 */
export const ENVIRONMENTS = {
  local: { configuration: null, isRemote: false, label: 'Local Development', envFileSuffix: null },
  qa: { configuration: 'qa', isRemote: true, label: 'Remote QA', envFileSuffix: 'qa' },
  staging: { configuration: 'staging', isRemote: true, label: 'Remote Staging', envFileSuffix: 'staging' },
  production: { configuration: 'production', isRemote: true, label: 'Production', envFileSuffix: 'prod' },
};

/**
 * Named device-selection profiles (Task 6) — a profile is just a predicate over the device
 * objects `devices.mjs` produces (`{id, name/model, isEmulator, kind: 'android'|'ios-simulator'|
 * 'ios-physical'}`), plus a human label. Declarative and centralized here for the same reason
 * APPS is: one place to add a new profile, no matching logic duplicated per-platform.
 */
export const DEVICE_PROFILES = {
  pixel: { label: 'Pixel (Android)', match: (d) => /pixel/i.test(d.name ?? d.model ?? '') },
  tablet: { label: 'Android Tablet', match: (d) => /tab|tablet/i.test(d.name ?? d.model ?? '') },
  fold: { label: 'Android Fold', match: (d) => /fold/i.test(d.name ?? d.model ?? '') },
  emulator: { label: 'Any Android Emulator', match: (d) => d.isEmulator === true },
  iphone: { label: 'iPhone', match: (d) => /iphone/i.test(d.name ?? '') },
  ipad: { label: 'iPad', match: (d) => /ipad/i.test(d.name ?? '') },
  simulator: { label: 'Any iOS Simulator', match: (d) => d.kind === 'ios-simulator' },
  physical: { label: 'Any Physical Device', match: (d) => d.isEmulator === false && d.kind !== 'ios-simulator' },
};

const DEFAULT_LOCAL_API_BASE_URL = 'http://localhost:3000';

export function resolveApp(alias) {
  const app = APPS[alias];
  if (!app) {
    throw new LauncherError({
      rootCause: `Unknown app "${alias}".`,
      suggestedFix: `Use one of: ${Object.keys(APPS).join(', ')}.`,
    });
  }
  return { alias, ...app };
}

export function resolveEnvironment(name = 'local') {
  const env = ENVIRONMENTS[name];
  if (!env) {
    throw new LauncherError({
      rootCause: `Unknown environment "${name}".`,
      suggestedFix: `Use one of: ${Object.keys(ENVIRONMENTS).join(', ')}.`,
    });
  }
  return { name, ...env };
}

export function resolveProfile(name) {
  if (!name) {
    return null;
  }
  const profile = DEVICE_PROFILES[name];
  if (!profile) {
    throw new LauncherError({
      rootCause: `Unknown device profile "${name}".`,
      suggestedFix: `Use one of: ${Object.keys(DEVICE_PROFILES).join(', ')}.`,
    });
  }
  return { name, ...profile };
}

/** Path to an app's environment.<suffix>.ts source file. `local` has no per-env file (see
 *  ENVIRONMENTS.local.envFileSuffix === null) — callers should check for that before calling. */
export function environmentFilePath(appProject, envName) {
  const suffix = ENVIRONMENTS[envName]?.envFileSuffix;
  if (!suffix) {
    return null;
  }
  return join(repoRoot, 'apps', appProject, 'src', 'environments', `environment.${suffix}.ts`);
}

/**
 * Reads the app's real environment.<env>.ts source (same technique as
 * scripts/verify-production-env.mjs — a regex extract, not a TS compile, since fileReplacements
 * swaps this exact file in verbatim for a matching build) to find apiBaseUrl. Returns the
 * documented localhost:3000 default for `local` without reading a file, since environment.ts's
 * own comment states that's what it points at and there's nothing env-specific to resolve.
 */
export function resolveApiBaseUrl(appProject, envName) {
  if (envName === 'local') {
    return DEFAULT_LOCAL_API_BASE_URL;
  }

  const envPath = environmentFilePath(appProject, envName);
  if (!envPath || !existsSync(envPath)) {
    return null;
  }

  const contents = readFileSync(envPath, 'utf8');
  const match = contents.match(/apiBaseUrl:\s*\n?\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

/** Reads an app's environment.ts (local) or environment.<suffix>.ts (otherwise) fully, for
 *  checks that need more than just apiBaseUrl (Google Maps key, Razorpay key, socket URL, ...). */
export function readEnvironmentFile(appProject, envName) {
  const envPath =
    envName === 'local'
      ? join(repoRoot, 'apps', appProject, 'src', 'environments', 'environment.ts')
      : environmentFilePath(appProject, envName);

  if (!envPath || !existsSync(envPath)) {
    return null;
  }
  return { path: envPath, contents: readFileSync(envPath, 'utf8') };
}

export class LauncherError extends Error {
  constructor({ rootCause, suggestedFix, nextAction, docs }) {
    super(rootCause);
    this.rootCause = rootCause;
    this.suggestedFix = suggestedFix;
    this.nextAction = nextAction;
    this.docs = docs;
  }
}
