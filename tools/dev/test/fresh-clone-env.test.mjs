import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { repoRoot } from '../../launcher/lib/registry.mjs';
import { ensureEnvFile, ensureLocalSecrets, readEnvVar, isPlaceholderValue } from '../lib/env-file.mjs';

/**
 * Acceptance tests for the fresh-machine bootstrap flow, run directly against this repo's actual
 * sibling backend checkout (patheya-express-platform) rather than synthetic fixtures — the bug
 * this guards against (env-file.mjs's setEnvVar corrupting CRLF-terminated files, see its own doc
 * comment) only reproduced against the REAL infrastructure/docker/.env.compose.example, because it
 * depends on that file's actual key ordering (LOG_TO_FILE immediately precedes JWT_ACCESS_SECRET).
 * A hand-written fixture could easily drift from that ordering and stop catching the regression.
 *
 * Skips entirely (not a failure) when the sibling backend repo isn't checked out next to this one
 * — same optional-sibling convention tools/dev/bootstrap.mjs itself uses.
 */
const BACKEND_REPO = join(repoRoot, '..', 'patheya-express-platform');
const COMPOSE_EXAMPLE = join(BACKEND_REPO, 'infrastructure', 'docker', '.env.compose.example');
const COMPOSE_FILE = join(BACKEND_REPO, 'infrastructure', 'docker', 'docker-compose.yml');
const BACKEND_ENV_EXAMPLE = join(BACKEND_REPO, 'apps', 'api-gateway', '.env.example');
const JWT_KEYS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
// Provisioned on the same idempotent, never-rotated terms as the JWT keys (see
// tools/dev/bootstrap.mjs's DOCKER_COMPOSE_SECRET_KEYS) even though — unlike them —
// BANK_ACCOUNT_ENCRYPTION_KEY isn't boot-required in development; a placeholder here only breaks
// the restaurant bank-account save/read endpoints, not container startup.
const SECRET_KEYS = [...JWT_KEYS, 'BANK_ACCOUNT_ENCRYPTION_KEY'];

const backendPresent = existsSync(COMPOSE_EXAMPLE) && existsSync(BACKEND_ENV_EXAMPLE);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

/** Converts LF to CRLF — simulates exactly what `git clone` produces on a Windows machine whose
 *  global `core.autocrlf` is `true` when checking out a repo with no `.gitattributes` forcing LF
 *  (confirmed true for patheya-express-platform at time of writing) — the real trigger for the
 *  fresh-machine failure this whole file guards against. */
function toCrlf(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
}

function dockerAvailable() {
  const result = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' });
  return result.status === 0;
}

describe('Fresh-clone environment bootstrap (acceptance)', { skip: !backendPresent ? 'sibling backend repo (patheya-express-platform) not checked out next to this repo' : false }, () => {
  let dir;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'patheya-fresh-clone-test-'));
  });

  after(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe('Test A — scaffold + generate makes real secret values present in .env.compose (LF and CRLF)', () => {
    for (const eol of ['LF', 'CRLF']) {
      test(`${eol} checkout: generated JWT_ACCESS_SECRET/JWT_REFRESH_SECRET/BANK_ACCOUNT_ENCRYPTION_KEY are present as their own real, non-placeholder values`, () => {
        const examplePath = join(dir, `compose-example-${eol}`);
        const envPath = join(dir, `compose-env-${eol}`);
        const exampleContents = readFileSync(COMPOSE_EXAMPLE, 'utf8');
        writeFileSync(examplePath, eol === 'CRLF' ? toCrlf(exampleContents) : exampleContents);

        const status = ensureEnvFile(examplePath, envPath);
        assert.equal(status, 'created');
        const secretResult = ensureLocalSecrets(envPath, SECRET_KEYS);
        assert.deepEqual(secretResult.generated.sort(), [...SECRET_KEYS].sort());

        const written = readFileSync(envPath, 'utf8');
        for (const key of SECRET_KEYS) {
          const value = readEnvVar(written, key);
          assert.ok(value, `${key} must be present as its own key=value line`);
          assert.equal(isPlaceholderValue(value), false, `${key} must not still be a placeholder`);
          assert.ok(value.length >= 32, `${key} must be a real generated secret, not a truncated/corrupted fragment`);
        }
        assert.notEqual(
          sha256(readEnvVar(written, 'JWT_ACCESS_SECRET')),
          sha256(readEnvVar(written, 'JWT_REFRESH_SECRET')),
          'the two secrets must be independently generated',
        );
        assert.notEqual(
          sha256(readEnvVar(written, 'JWT_ACCESS_SECRET')),
          sha256(readEnvVar(written, 'BANK_ACCOUNT_ENCRYPTION_KEY')),
          'BANK_ACCOUNT_ENCRYPTION_KEY must be independently generated from the JWT keys',
        );
      });
    }
  });

  describe('Test B — Docker Compose interpolation resolves the generated values, not the example placeholders', { skip: !dockerAvailable() ? 'docker compose not available in this environment' : false }, () => {
    test('docker compose config resolves JWT_ACCESS_SECRET/JWT_REFRESH_SECRET/BANK_ACCOUNT_ENCRYPTION_KEY to the generated values, for both api-gateway and worker', () => {
      const examplePath = join(dir, 'compose-example-b');
      const envPath = join(dir, 'compose-env-b');
      writeFileSync(examplePath, toCrlf(readFileSync(COMPOSE_EXAMPLE, 'utf8')));
      ensureEnvFile(examplePath, envPath);
      ensureLocalSecrets(envPath, SECRET_KEYS);
      const written = readFileSync(envPath, 'utf8');
      const expectedHashes = Object.fromEntries(SECRET_KEYS.map((key) => [key, sha256(readEnvVar(written, key))]));
      const expectedLogToFile = readEnvVar(written, 'LOG_TO_FILE');
      const composeFallbackDefaults = {
        JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
        JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me',
        BANK_ACCOUNT_ENCRYPTION_KEY: 'dev-bank-account-key-change-me',
      };

      // --profile worker makes `config` include the (otherwise opt-in) worker service too, so this
      // one invocation verifies both places docker-compose.yml sets these keys — see its own
      // top-of-file comment for why the worker service duplicates the api-gateway service's secrets.
      const result = spawnSync('docker', ['compose', '-f', COMPOSE_FILE, '--env-file', envPath, '--profile', 'worker', 'config'], { encoding: 'utf8' });
      assert.equal(result.status, 0, `docker compose config must succeed: ${result.stderr}`);

      const configOut = result.stdout;
      for (const key of SECRET_KEYS) {
        // docker compose config renders every service's environment block, so a per-key global
        // regex over the whole output covers both api-gateway and worker at once; each match must
        // resolve to the same generated value (never the compose-file placeholder default).
        const matches = [...configOut.matchAll(new RegExp(`${key}:\\s*"?([^"\\r\\n]+)"?`, 'g'))];
        assert.ok(matches.length >= 2, `docker compose config must resolve ${key} for both api-gateway and worker (found ${matches.length})`);
        for (const match of matches) {
          const resolved = match[1].trim();
          // Compare by hash only — never assert equality against (or print) the raw secret value.
          assert.equal(sha256(resolved), expectedHashes[key], `resolved ${key} must match the generated value, not the compose-file placeholder default`);
          assert.notEqual(resolved, composeFallbackDefaults[key], `${key} must not have fallen back to the compose-file placeholder default`);
        }
      }

      // LOG_TO_FILE must survive untouched (it's not a generated key) and resolve to exactly what
      // the source example shipped — never a corrupted multi-line blob.
      const logToFileMatch = configOut.match(/LOG_TO_FILE:\s*"?([^"\r\n]+)"?/);
      assert.ok(logToFileMatch, 'docker compose config must resolve LOG_TO_FILE');
      assert.equal(logToFileMatch[1].trim(), expectedLogToFile);
      assert.match(logToFileMatch[1].trim(), /^(true|false)$/, 'LOG_TO_FILE must resolve to a plain true/false, not a corrupted value');
    });
  });

  describe('Test E — existing valid secrets are preserved (idempotence), CRLF included', () => {
    test('a real, already-valid secret survives a second ensureLocalSecrets() call untouched', () => {
      const envPath = join(dir, 'idempotent-env');
      writeFileSync(envPath, toCrlf(readFileSync(COMPOSE_EXAMPLE, 'utf8')));

      const first = ensureLocalSecrets(envPath, SECRET_KEYS);
      assert.deepEqual(first.generated.sort(), [...SECRET_KEYS].sort());
      const afterFirst = readFileSync(envPath, 'utf8');
      const hashesAfterFirst = Object.fromEntries(SECRET_KEYS.map((k) => [k, sha256(readEnvVar(afterFirst, k))]));

      const second = ensureLocalSecrets(envPath, SECRET_KEYS);
      assert.deepEqual(second.preserved.sort(), [...SECRET_KEYS].sort());
      assert.deepEqual(second.generated, []);
      const afterSecond = readFileSync(envPath, 'utf8');
      assert.equal(afterSecond, afterFirst, 'file must be byte-identical — no rewrite when nothing changed');
      for (const key of SECRET_KEYS) {
        assert.equal(sha256(readEnvVar(afterSecond, key)), hashesAfterFirst[key]);
      }
    });
  });

  describe('Test F — placeholder secrets shipped by the real example files are replaced', () => {
    test('.env.compose.example\'s shipped placeholders are recognized and replaced', () => {
      const contents = readFileSync(COMPOSE_EXAMPLE, 'utf8');
      for (const key of SECRET_KEYS) {
        assert.equal(isPlaceholderValue(readEnvVar(contents, key)), true, `the example file is expected to still ship a placeholder for ${key} — this test's premise`);
      }

      const envPath = join(dir, 'placeholder-replaced');
      writeFileSync(envPath, contents);
      const result = ensureLocalSecrets(envPath, SECRET_KEYS);
      assert.deepEqual(result.generated.sort(), [...SECRET_KEYS].sort());
    });

    test('apps/api-gateway/.env.example\'s shipped placeholders are recognized and replaced (native start:dev path)', () => {
      const contents = readFileSync(BACKEND_ENV_EXAMPLE, 'utf8');
      for (const key of SECRET_KEYS) {
        assert.equal(isPlaceholderValue(readEnvVar(contents, key)), true, `expected ${key} to still ship a placeholder in this example file`);
      }

      const envPath = join(dir, 'backend-placeholder-replaced');
      writeFileSync(envPath, toCrlf(contents));
      const result = ensureLocalSecrets(envPath, SECRET_KEYS);
      assert.deepEqual(result.generated.sort(), [...SECRET_KEYS].sort());

      // The line immediately preceding JWT_ACCESS_SECRET in this file (REDIS_PORT) must survive
      // untouched — this is the same adjacent-line corruption class Test A/B guard against, just
      // against the second file the bootstrap also writes secrets into.
      const written = readFileSync(envPath, 'utf8');
      assert.equal(readEnvVar(written, 'REDIS_PORT'), readEnvVar(contents, 'REDIS_PORT'));
      assert.equal(readEnvVar(written, 'DATABASE_URL'), readEnvVar(contents, 'DATABASE_URL'));
    });
  });

  describe('Test G — no secret value ever appears in a diagnostic/result surface', () => {
    test('ensureLocalSecrets\' own return value never contains the generated secret text', () => {
      const envPath = join(dir, 'no-leak-env');
      writeFileSync(envPath, toCrlf(readFileSync(COMPOSE_EXAMPLE, 'utf8')));
      const result = ensureLocalSecrets(envPath, SECRET_KEYS);
      const written = readFileSync(envPath, 'utf8');
      const serializedResult = JSON.stringify(result);
      for (const key of SECRET_KEYS) {
        const value = readEnvVar(written, key);
        assert.equal(serializedResult.includes(value), false, `${key}'s generated value must never appear in ensureLocalSecrets' return value`);
      }
    });
  });
});
