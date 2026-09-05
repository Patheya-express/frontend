import { existsSync, copyFileSync } from 'node:fs';

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
