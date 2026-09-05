import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import {
  extractDatabaseUrl,
  parseDatabaseUrl,
  probeTcpPort,
  buildSchemaCheckCommand,
  isSchemaPresent,
} from '../lib/db-verify.mjs';

describe('extractDatabaseUrl', () => {
  test('extracts a quoted value', () => {
    const contents = 'NODE_ENV=development\nDATABASE_URL="postgresql://postgres:postgres@localhost:15432/patheya_express_db?schema=public"\nPORT=3000\n';
    assert.equal(extractDatabaseUrl(contents), 'postgresql://postgres:postgres@localhost:15432/patheya_express_db?schema=public');
  });

  test('extracts an unquoted value', () => {
    const contents = 'DATABASE_URL=postgresql://postgres:postgres@localhost:15432/patheya_express_db\n';
    assert.equal(extractDatabaseUrl(contents), 'postgresql://postgres:postgres@localhost:15432/patheya_express_db');
  });

  test('returns null when DATABASE_URL is absent', () => {
    assert.equal(extractDatabaseUrl('NODE_ENV=development\nPORT=3000\n'), null);
  });

  test('does not match a key that merely contains DATABASE_URL as a substring', () => {
    assert.equal(extractDatabaseUrl('OLD_DATABASE_URL=postgresql://x\n'), null);
  });
});

describe('parseDatabaseUrl', () => {
  test('extracts host, port, user, and database', () => {
    const parsed = parseDatabaseUrl('postgresql://postgres:postgres@localhost:15432/patheya_express_db?schema=public');
    assert.deepEqual(parsed, { host: 'localhost', port: 15432, user: 'postgres', database: 'patheya_express_db' });
  });

  test('defaults port to 5432 when absent', () => {
    const parsed = parseDatabaseUrl('postgresql://postgres:postgres@localhost/patheya_express_db');
    assert.equal(parsed.port, 5432);
  });

  test('throws on a malformed URL', () => {
    assert.throws(() => parseDatabaseUrl('not-a-connection-string'));
  });
});

describe('probeTcpPort', () => {
  test('resolves true when something is listening', async () => {
    const server = createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    try {
      assert.equal(await probeTcpPort('127.0.0.1', port), true);
    } finally {
      server.close();
    }
  });

  test('resolves false when nothing is listening', async () => {
    // Port 1 is a privileged, essentially-never-bound port — reserved specifically so this test
    // has a deterministic "closed" target without racing a real ephemeral-port allocation.
    assert.equal(await probeTcpPort('127.0.0.1', 1, 500), false);
  });
});

describe('buildSchemaCheckCommand', () => {
  test('builds a docker compose exec psql invocation checking both canonical tables', () => {
    const args = buildSchemaCheckCommand({ composeFile: 'infrastructure/docker/docker-compose.yml', user: 'postgres', database: 'patheya_express_db' });
    assert.deepEqual(args.slice(0, 6), ['compose', '-f', 'infrastructure/docker/docker-compose.yml', 'exec', '-T', 'postgres']);
    assert.ok(args.includes('psql'));
    assert.ok(args.includes('-U'));
    assert.ok(args.includes('postgres'));
    assert.ok(args.includes('-d'));
    assert.ok(args.includes('patheya_express_db'));
    const sql = args.at(-1);
    assert.match(sql, /_prisma_migrations/);
    assert.match(sql, /public\.users/);
  });
});

describe('isSchemaPresent', () => {
  test('true for psql\'s "t" output', () => {
    assert.equal(isSchemaPresent('t\n'), true);
  });

  test('false for psql\'s "f" output', () => {
    assert.equal(isSchemaPresent('f\n'), false);
  });

  test('false for empty/unexpected output', () => {
    assert.equal(isSchemaPresent(''), false);
    assert.equal(isSchemaPresent('ERROR: relation does not exist\n'), false);
  });
});
