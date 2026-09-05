import { connect } from 'node:net';

/**
 * Guards against the exact incident this module exists to catch: `prisma migrate dev`/`migrate
 * status` reporting success against *some* PostgreSQL server reachable at DATABASE_URL's
 * host:port, while the Docker-managed database the API container actually uses has none of that
 * schema — e.g. a native PostgreSQL install answering on the same port a developer's `.env` (or a
 * stale port-forward) happens to point at. `prisma migrate dev`'s own exit code can't detect this:
 * from Prisma's point of view, "up to date" against an empty-but-matching-history database and
 * "up to date" against the real one look identical. Every function here is a pure parser/builder
 * (no I/O beyond probeTcpPort's socket) so this is independently unit-testable without Docker.
 */

/** Extracts DATABASE_URL's value from a dotenv-format file's raw text — same lightweight,
 *  dependency-free approach as the rest of tools/dev (see env-file.mjs), not a general dotenv
 *  parser. Handles both quoted and unquoted values; returns null if the key isn't present. */
export function extractDatabaseUrl(envFileContents) {
  const match = envFileContents.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+?)"?\s*$/m);
  return match ? match[1] : null;
}

/** Pulls out only what the schema check needs (host, port, user, database) from a PostgreSQL
 *  connection string. Throws on a genuinely malformed URL — callers decide how to report that. */
export function parseDatabaseUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username || 'postgres'),
    database: url.pathname.replace(/^\//, '') || 'postgres',
  };
}

/** True once a TCP connection to `host:port` completes — i.e. *something* is listening. Doesn't
 *  speak the Postgres wire protocol; that's exactly right here, since the schema check right after
 *  this is what actually confirms it's the expected database. Never throws. */
export function probeTcpPort(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const socket = connect({ host, port, timeout: timeoutMs });
    const finish = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

/**
 * Builds the `docker compose ... exec ... psql ...` argv that checks, inside the postgres
 * container itself (not through the host-published port — that's probeTcpPort's job), whether
 * both `_prisma_migrations` (proof a migration history exists at all) and `users` (the one
 * canonical, always-present application table — every registration/auth flow depends on it, see
 * apps/api-gateway/prisma/schema.prisma's `@@map("users")`) exist. Deliberately not a longer table
 * list: one canonical table is enough to detect "wrong/empty database" without this check becoming
 * a second, drifting copy of the Prisma schema.
 */
export function buildSchemaCheckCommand({ composeFile, user, database }) {
  const sql = "SELECT (to_regclass('public._prisma_migrations') IS NOT NULL) AND (to_regclass('public.users') IS NOT NULL);";
  return ['compose', '-f', composeFile, 'exec', '-T', 'postgres', 'psql', '-U', user, '-d', database, '-tAc', sql];
}

/** psql's `-tAc` output for a single boolean column is just `t`/`f` (plus a trailing newline) —
 *  this is the only parsing `buildSchemaCheckCommand`'s result needs. */
export function isSchemaPresent(stdout) {
  return stdout.trim() === 't';
}
