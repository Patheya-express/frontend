import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureEnvFile } from '../lib/env-file.mjs';

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
