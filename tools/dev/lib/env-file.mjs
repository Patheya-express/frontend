import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

/**
 * Copies `examplePath` -> `envPath` only if `envPath` doesn't already exist. Pure file-existence +
 * copy, no secret generation, no overwrite of a developer's real local values — node:fs only, so
 * this is safe to call before frontend node_modules exists (bootstrap.mjs's pre-install phase has
 * no dependency-backed imports available yet).
 *
 * Returns a status string rather than logging directly — this module doesn't know about
 * tools/launcher/lib/log.mjs (which itself is dependency-free too, but keeping this module's
 * contract to "pure file operation, plain return value" makes it trivially unit-testable without
 * capturing console output).
 */
export function ensureEnvFile(examplePath, envPath) {
  if (!existsSync(examplePath)) {
    return 'example-missing';
  }
  if (existsSync(envPath)) {
    return 'already-exists';
  }
  copyFileSync(examplePath, envPath);
  return 'created';
}

/**
 * Case-insensitive substrings that mark a value as an unedited placeholder rather than a real
 * local secret. Kept in sync BY HAND with the backend's own `PLACEHOLDER_SUBSTRINGS`
 * (patheya-express-platform/apps/api-gateway/src/config/env.validation.ts) — that Joi schema is
 * the actual validator that rejects these at boot (`"JWT_ACCESS_SECRET" still contains an unedited
 * placeholder value`), so this list exists purely to catch the same problem before it ever reaches
 * that validator. Duplicated rather than imported because this repo's bootstrap tooling can never
 * depend on the sibling repo's source (they're separate checkouts, sometimes cloned without the
 * other present at all — see bootstrap.mjs's own `backendPresent` guard).
 */
export const PLACEHOLDER_SUBSTRINGS = [
  'replace-with',
  'replace_with',
  'changeme',
  'change-me',
  'change_me',
  'your-secret',
  'your_secret',
  'insert-secret',
  'secret-here',
  'xxxxxxxx',
];

/** True for a missing/empty value or one containing any of PLACEHOLDER_SUBSTRINGS — i.e. "this is
 *  not a real secret yet and needs one generated". */
export function isPlaceholderValue(value) {
  if (!value) {
    return true;
  }
  const lower = value.toLowerCase();
  return PLACEHOLDER_SUBSTRINGS.some((pattern) => lower.includes(pattern));
}

/**
 * Generates a cryptographically strong, dotenv- and shell-safe local secret. base64url has none of
 * `+`, `/`, or `=` — the exact characters that would otherwise need quoting in a dotenv file or
 * escaping when Docker Compose substitutes the value into a container's environment — so the
 * result can always be written as a bare, unquoted `KEY=value` line. 48 random bytes -> 64
 * characters, comfortably over every length minimum env.validation.ts enforces in production
 * (20-32), even though these values are only ever used for local development.
 */
export function generateSecret(byteLength = 48) {
  return randomBytes(byteLength).toString('base64url');
}

/** Reads a single `KEY=value` line's value from dotenv-format text, tolerating an optionally
 *  quoted value — the same lightweight, non-general-purpose approach as db-verify.mjs's
 *  extractDatabaseUrl, generalized to any key. Returns `undefined` (not `null`) when the key is
 *  absent, so callers can feed the result straight into isPlaceholderValue() (which already
 *  treats a falsy value as "needs a real value"). */
export function readEnvVar(contents, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = contents.match(new RegExp(`^\\s*${escaped}\\s*=\\s*"?([^"\\r\\n]*?)"?\\s*$`, 'm'));
  return match ? match[1] : undefined;
}

/** Sets `KEY=value` in dotenv-format text — replacing an existing `KEY=...` line in place, or
 *  appending a new one if the key isn't present yet. Every other line (comments, blank lines,
 *  every other variable) is preserved byte-for-byte; this never reformats or reorders the file. */
export function setEnvVar(contents, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linePattern = new RegExp(`^\\s*${escaped}\\s*=.*$`, 'm');
  const newLine = `${key}=${value}`;
  if (linePattern.test(contents)) {
    return contents.replace(linePattern, newLine);
  }
  const separator = contents === '' || contents.endsWith('\n') ? '' : '\n';
  return `${contents}${separator}${newLine}\n`;
}

/**
 * Idempotently ensures every key in `keys` holds a real, non-placeholder local secret inside the
 * env file at `envPath` — generating and writing a fresh cryptographically random value for any
 * key that's missing, empty, or still an unedited placeholder (see PLACEHOLDER_SUBSTRINGS), and
 * leaving every other key completely untouched. An already-valid developer-chosen or
 * previously-generated secret is never regenerated or overwritten, so this is safe to call on
 * every `pnpm run setup`/`pnpm run dev` — not just the first one — without ever rotating a secret
 * a developer (or a previous run of this same function) already set correctly.
 *
 * Never returns or logs the generated values themselves — only which keys were touched — so a
 * caller can report "local development secrets generated" without a real secret ever reaching
 * terminal output, a log file, or a test assertion.
 */
export function ensureLocalSecrets(envPath, keys) {
  if (!existsSync(envPath)) {
    return { ok: false, generated: [], preserved: [] };
  }
  let contents = readFileSync(envPath, 'utf8');
  const generated = [];
  const preserved = [];
  for (const key of keys) {
    if (isPlaceholderValue(readEnvVar(contents, key))) {
      contents = setEnvVar(contents, key, generateSecret());
      generated.push(key);
    } else {
      preserved.push(key);
    }
  }
  if (generated.length > 0) {
    writeFileSync(envPath, contents);
  }
  return { ok: true, generated, preserved };
}
