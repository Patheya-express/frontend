import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureEnvFile, isPlaceholderValue, generateSecret, readEnvVar, setEnvVar, ensureLocalSecrets } from '../lib/env-file.mjs';

describe('ensureEnvFile', () => {
  let dir;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'patheya-env-file-test-'));
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('creates envPath from examplePath when envPath does not exist', () => {
    const examplePath = join(dir, 'case1.env.example');
    const envPath = join(dir, 'case1.env');
    writeFileSync(examplePath, 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/db\n');

    const status = ensureEnvFile(examplePath, envPath);

    assert.equal(status, 'created');
    assert.ok(existsSync(envPath));
    assert.equal(readFileSync(envPath, 'utf8'), readFileSync(examplePath, 'utf8'));
  });

  test('never overwrites an existing envPath — a developer\'s real local values are preserved', () => {
    const examplePath = join(dir, 'case2.env.example');
    const envPath = join(dir, 'case2.env');
    writeFileSync(examplePath, 'JWT_ACCESS_SECRET=replace-with-a-long-random-value\n');
    writeFileSync(envPath, 'JWT_ACCESS_SECRET=a-real-developer-chosen-secret\n');

    const status = ensureEnvFile(examplePath, envPath);

    assert.equal(status, 'already-exists');
    assert.equal(readFileSync(envPath, 'utf8'), 'JWT_ACCESS_SECRET=a-real-developer-chosen-secret\n');
  });

  test('reports example-missing without throwing when the example file does not exist', () => {
    const examplePath = join(dir, 'does-not-exist.env.example');
    const envPath = join(dir, 'case3.env');

    const status = ensureEnvFile(examplePath, envPath);

    assert.equal(status, 'example-missing');
    assert.equal(existsSync(envPath), false);
  });

  test('is idempotent — calling twice in a row never changes an already-created file', () => {
    const examplePath = join(dir, 'case4.env.example');
    const envPath = join(dir, 'case4.env');
    writeFileSync(examplePath, 'PORT=3000\n');

    const first = ensureEnvFile(examplePath, envPath);
    const second = ensureEnvFile(examplePath, envPath);

    assert.equal(first, 'created');
    assert.equal(second, 'already-exists');
    assert.equal(readFileSync(envPath, 'utf8'), 'PORT=3000\n');
  });
});

describe('isPlaceholderValue', () => {
  test('true for the two literal placeholders shipped by .env.example / .env.compose.example', () => {
    assert.equal(isPlaceholderValue('replace-with-a-long-random-value'), true);
    assert.equal(isPlaceholderValue('dev-access-secret-change-me'), true);
  });

  test('true for missing or empty values', () => {
    assert.equal(isPlaceholderValue(undefined), true);
    assert.equal(isPlaceholderValue(''), true);
  });

  test('false for a real generated secret', () => {
    assert.equal(isPlaceholderValue(generateSecret()), false);
  });

  test('case-insensitive', () => {
    assert.equal(isPlaceholderValue('CHANGE-ME'), true);
  });
});

describe('generateSecret', () => {
  test('produces a long, dotenv/shell-safe (no +, /, =) value', () => {
    const secret = generateSecret();
    assert.ok(secret.length >= 32);
    assert.doesNotMatch(secret, /[+/=]/);
  });

  test('two calls never collide', () => {
    assert.notEqual(generateSecret(), generateSecret());
  });
});

describe('readEnvVar / setEnvVar', () => {
  test('readEnvVar reads a quoted and an unquoted value', () => {
    assert.equal(readEnvVar('FOO="bar"\n', 'FOO'), 'bar');
    assert.equal(readEnvVar('FOO=bar\n', 'FOO'), 'bar');
  });

  test('readEnvVar returns undefined when the key is absent', () => {
    assert.equal(readEnvVar('OTHER=1\n', 'FOO'), undefined);
  });

  test('setEnvVar replaces an existing line in place, preserving every other line', () => {
    const before = 'A=1\nFOO=old\nB=2\n';
    const after = setEnvVar(before, 'FOO', 'new');
    assert.equal(after, 'A=1\nFOO=new\nB=2\n');
  });

  test('setEnvVar appends a new line when the key is absent', () => {
    const after = setEnvVar('A=1\n', 'FOO', 'new');
    assert.equal(after, 'A=1\nFOO=new\n');
  });
});

describe('ensureLocalSecrets', () => {
  let dir;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'patheya-secrets-test-'));
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('generates a real secret for a placeholder value, without ever exposing the value itself in the result', () => {
    const envPath = join(dir, 'case1.env');
    writeFileSync(envPath, 'JWT_ACCESS_SECRET=replace-with-a-long-random-value\nOTHER=kept\n');

    const result = ensureLocalSecrets(envPath, ['JWT_ACCESS_SECRET']);

    assert.deepEqual(result.generated, ['JWT_ACCESS_SECRET']);
    assert.deepEqual(result.preserved, []);
    const written = readFileSync(envPath, 'utf8');
    assert.doesNotMatch(written, /replace-with-a-long-random-value/);
    assert.match(written, /OTHER=kept/, 'unrelated lines must be preserved untouched');
    // The result object itself never carries the generated value — only which keys changed.
    assert.equal(JSON.stringify(result).includes(readEnvVar(written, 'JWT_ACCESS_SECRET')), false);
  });

  test('preserves an already-valid secret — idempotent, never rotates a real value', () => {
    const envPath = join(dir, 'case2.env');
    const realSecret = generateSecret();
    writeFileSync(envPath, `JWT_ACCESS_SECRET=${realSecret}\n`);

    const result = ensureLocalSecrets(envPath, ['JWT_ACCESS_SECRET']);

    assert.deepEqual(result.generated, []);
    assert.deepEqual(result.preserved, ['JWT_ACCESS_SECRET']);
    assert.equal(readEnvVar(readFileSync(envPath, 'utf8'), 'JWT_ACCESS_SECRET'), realSecret);
  });

  test('calling twice in a row only generates once — the second call preserves the first call\'s output', () => {
    const envPath = join(dir, 'case3.env');
    writeFileSync(envPath, 'JWT_ACCESS_SECRET=change-me\nJWT_REFRESH_SECRET=change-me\n');

    const first = ensureLocalSecrets(envPath, ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']);
    const contentsAfterFirst = readFileSync(envPath, 'utf8');
    const second = ensureLocalSecrets(envPath, ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']);

    assert.equal(first.generated.length, 2);
    assert.equal(second.generated.length, 0);
    assert.deepEqual(second.preserved.sort(), ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']);
    assert.equal(readFileSync(envPath, 'utf8'), contentsAfterFirst, 'the file must not be rewritten when nothing changed');
  });

  test('generates independent values for two different keys (JWT_ACCESS_SECRET must differ from JWT_REFRESH_SECRET)', () => {
    const envPath = join(dir, 'case4.env');
    writeFileSync(envPath, 'JWT_ACCESS_SECRET=\nJWT_REFRESH_SECRET=\n');

    ensureLocalSecrets(envPath, ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']);

    const contents = readFileSync(envPath, 'utf8');
    assert.notEqual(readEnvVar(contents, 'JWT_ACCESS_SECRET'), readEnvVar(contents, 'JWT_REFRESH_SECRET'));
  });

  test('returns ok:false without throwing when the target file does not exist', () => {
    const result = ensureLocalSecrets(join(dir, 'does-not-exist.env'), ['JWT_ACCESS_SECRET']);
    assert.equal(result.ok, false);
    assert.deepEqual(result.generated, []);
  });
});
