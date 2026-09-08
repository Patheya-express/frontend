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

/**
 * Splits dotenv-format text into lines on `\n` only, stripping (and remembering) each line's own
 * optional trailing `\r` individually. This is the key fix for the FOURTH FRESH-MACHINE FAILURE:
 * a naive multiline regex (`^...$` with the `m` flag) is not CRLF-safe in JS — `^`/`$` treat a
 * bare `\r` as its own line terminator, so on a CRLF file (exactly what `git clone` on Windows
 * produces for this repo's sibling backend checkout, which has no `.gitattributes` forcing LF —
 * unlike this repo's own, see this repo's own `.gitattributes`), `^` for the target key could
 * match *inside* the preceding line's terminator (right after its `\r`, before its `\n`), and a
 * trailing `\s*` in the old pattern would then silently swallow that real `\n` into the match.
 * `String#replace` then deleted it along with the matched text, merging the previous line's
 * content directly onto the replacement with no newline between them — which both destroyed the
 * key being replaced as its own parseable `KEY=value` line (folding it into the *previous* key's
 * value instead) and corrupted that previous key's value. Verified against this repo's actual
 * checked-out `.env.compose.example` (LOG_TO_FILE immediately precedes JWT_ACCESS_SECRET there):
 * this exact bug reproduced BOTH real fresh-machine symptoms at once — JWT_ACCESS_SECRET/
 * JWT_REFRESH_SECRET vanishing as distinct keys (so Docker Compose's `${JWT_ACCESS_SECRET:-dev-
 * access-secret-change-me}` fell back to its own hardcoded placeholder default) and LOG_TO_FILE's
 * value becoming a garbled multi-line blob that failed Joi's `.boolean()` check. Processing
 * line-by-line (each line's own `^`/`$` are the string's actual start/end, never a regex line-
 * terminator quirk) and re-attaching each line's own original `\r` (or lack of one) makes both
 * readEnvVar and setEnvVar correct on LF, CRLF, and even mixed-line-ending files without ever
 * reformatting a line this code didn't touch.
 */
function splitPreservingLineEndings(contents) {
  return contents.split('\n').map((rawLine) => {
    const hasCarriageReturn = rawLine.endsWith('\r');
    return { text: hasCarriageReturn ? rawLine.slice(0, -1) : rawLine, hasCarriageReturn };
  });
}

/** Reads a single `KEY=value` line's value from dotenv-format text, tolerating an optionally
 *  quoted value — the same lightweight, non-general-purpose approach as db-verify.mjs's
 *  extractDatabaseUrl, generalized to any key. Returns `undefined` (not `null`) when the key is
 *  absent, so callers can feed the result straight into isPlaceholderValue() (which already
 *  treats a falsy value as "needs a real value"). */
export function readEnvVar(contents, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^\\s*${escaped}\\s*=\\s*"?([^"]*?)"?\\s*$`);
  for (const { text } of splitPreservingLineEndings(contents)) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

/** Sets `KEY=value` in dotenv-format text — replacing an existing `KEY=...` line in place, or
 *  appending a new one if the key isn't present yet. Every other line (comments, blank lines,
 *  every other variable) is preserved byte-for-byte, including each line's own original `\r\n` vs
 *  `\n` ending; this never reformats or reorders the file. */
export function setEnvVar(contents, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^\\s*${escaped}\\s*=`);
  const lines = splitPreservingLineEndings(contents);
  const newLine = `${key}=${value}`;

  let found = false;
  const updated = lines.map(({ text, hasCarriageReturn }) => {
    if (!found && pattern.test(text)) {
      found = true;
      return { text: newLine, hasCarriageReturn };
    }
    return { text, hasCarriageReturn };
  });

  if (found) {
    return updated.map(({ text, hasCarriageReturn }) => text + (hasCarriageReturn ? '\r' : '')).join('\n');
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
