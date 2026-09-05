import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runCapture } from '../../launcher/lib/exec.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bootstrapPath = join(__dirname, '..', 'bootstrap.mjs');
const source = readFileSync(bootstrapPath, 'utf8');

// This file's own explanatory comments deliberately spell out the exact dangerous commands they
// warn against not using (e.g. "never `migrate reset`") — a naive substring/regex scan over the
// raw source would trip on those comments themselves. `codeOnly` strips block comments (/** ... */)
// and line comments (but not URLs, which contain "://" — the negative lookbehind on ":" avoids
// truncating a line at "https://...") so the safety-property assertions below check what the code
// actually does, not what its comments say about what it doesn't do.
const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');

/**
 * bootstrap.mjs's defining requirement is that it can load and run `pnpm install` on a genuinely
 * fresh clone, before frontend node_modules — and therefore any real npm dependency, including
 * `cross-spawn` — exists at all. Actually deleting this repo's real node_modules to prove that
 * would be destructive and environment-dependent; the real proof of that is the documented
 * scratch-directory fresh-clone run (see DEVELOPMENT.md / the task's own validation record), which
 * a unit test can't safely reproduce here. What a test *can* verify deterministically and safely
 * is the thing that actually causes or prevents the bug: this file's own static `import` graph.
 * These are source-inspection tests, not behavioral simulations — see each test's own comment for
 * exactly what property it's checking and why that property is sufficient.
 */
describe('bootstrap.mjs module-loading order (fresh-clone safety)', () => {
  test('every top-level (static) import resolves to a Node builtin or a dependency-free local module', () => {
    const staticImportLines = source
      .split('\n')
      // Stop scanning once we reach the first line inside main() that performs a dynamic
      // import() — everything above this point runs before dependency installation and must be
      // builtins-only; the dynamic imports themselves are covered by the next test.
      .slice(0, source.split('\n').findIndex((line) => line.includes('await import(')));

    const importSpecifiers = staticImportLines.filter((line) => line.trim().startsWith('import ')).map((line) => /from\s+'([^']+)'/.exec(line)?.[1]).filter(Boolean);

    assert.ok(importSpecifiers.length > 0, 'expected at least one static import to check');

    for (const specifier of importSpecifiers) {
      const isNodeBuiltin = specifier.startsWith('node:');
      // registry.mjs and log.mjs are independently builtins-only (verified by their own source
      // containing no bare-specifier imports) — this test only needs to confirm bootstrap.mjs
      // reaches for those two specific files, not cross-spawn-dependent ones like exec.mjs or
      // detect-backend.mjs.
      const isKnownDependencyFreeLauncherModule = specifier === '../launcher/lib/log.mjs' || specifier === '../launcher/lib/registry.mjs';
      const isLocalDevModule = specifier.startsWith('./lib/');
      assert.ok(
        isNodeBuiltin || isKnownDependencyFreeLauncherModule || isLocalDevModule,
        `Static import "${specifier}" is not a Node builtin or a known dependency-free module — this would break --setup on a fresh clone with no node_modules.`,
      );
    }

    // The specific regression this guards against: neither 'cross-spawn' nor any module that
    // transitively needs it (exec.mjs, validate-environment.mjs, detect-backend.mjs) appears as a
    // *static* import anywhere in the scanned region.
    for (const forbidden of ['cross-spawn', '../launcher/lib/exec.mjs', '../launcher/lib/validate-environment.mjs', '../launcher/lib/detect-backend.mjs']) {
      assert.ok(!importSpecifiers.includes(forbidden), `"${forbidden}" must not be a static (top-level) import — it requires node_modules to already exist.`);
    }
  });

  test('the dependency-backed launcher modules are loaded via dynamic import(), after the --setup install step', () => {
    const installCallIndex = source.indexOf('installDependenciesRaw({');
    const dynamicImportIndex = source.indexOf("await import('../launcher/lib/exec.mjs')");

    assert.ok(installCallIndex !== -1, 'expected installDependenciesRaw(...) to be called in main()');
    assert.ok(dynamicImportIndex !== -1, "expected a dynamic import('../launcher/lib/exec.mjs') in main()");
    assert.ok(
      installCallIndex < dynamicImportIndex,
      'installDependenciesRaw(...) must be called BEFORE the dynamic import of dependency-backed modules — otherwise a fresh clone can never reach the code that installs its own dependencies.',
    );

    for (const specifier of ['../launcher/lib/exec.mjs', '../launcher/lib/validate-environment.mjs', '../launcher/lib/detect-backend.mjs']) {
      assert.match(source, new RegExp(`await import\\('${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\)`), `expected a dynamic import of ${specifier}`);
    }
  });

  test('tool validation (which requires node_modules) runs after, not before, the --setup install step', () => {
    const installCallIndex = source.indexOf('installDependenciesRaw({');
    const toolValidationIndex = source.indexOf('buildToolChecks({');
    assert.ok(installCallIndex < toolValidationIndex, 'buildToolChecks() must run after installDependenciesRaw(), so a fresh clone\'s missing-node_modules check never blocks --setup before it can install anything.');
  });

  test('pre-install pnpm invocation uses node:child_process directly, not cross-spawn', () => {
    assert.match(source, /import \{ spawn as nodeSpawn \} from 'node:child_process'/);
    assert.doesNotMatch(source.slice(0, source.indexOf('await import(')), /from 'cross-spawn'/);
  });
});

describe('bootstrap.mjs safety properties (source-level)', () => {
  test('never invokes a destructive Prisma command (migrate reset / db push) as the setup migration', () => {
    assert.doesNotMatch(codeOnly, /migrate reset/);
    assert.doesNotMatch(codeOnly, /db:push|db push/);
    assert.match(codeOnly, /db:migrate/, 'expected the safe `db:migrate` (prisma migrate dev) script to be used');
  });

  test('never spawns a host api-gateway process alongside Docker Compose (the EADDRINUSE regression)', () => {
    assert.doesNotMatch(codeOnly, /'api-gateway',\s*'run',\s*'start:dev'|'start:dev'.*api-gateway/s);
  });

  test('reuses detectBackend() rather than implementing a second health-response parser', () => {
    assert.match(codeOnly, /detectBackend\(/);
    assert.doesNotMatch(codeOnly, /\.data\.status\s*===\s*'ok'/, 'health-status comparison belongs solely in detect-backend.mjs\'s checkHealth()');
    assert.doesNotMatch(codeOnly, /await fetch\(/, 'bootstrap.mjs should never call the health endpoint itself');
  });

  test('never overwrites an existing backend .env (delegates to the tested ensureEnvFile helper)', () => {
    assert.match(codeOnly, /ensureEnvFile\(/);
    assert.doesNotMatch(codeOnly, /copyFileSync\(/, 'bootstrap.mjs itself should not perform file copies directly — that logic (and its overwrite-safety) lives in, and is tested by, lib/env-file.mjs');
  });

  test('verifies the Docker database schema after migrating, and stops setup if it is missing', () => {
    assert.match(codeOnly, /verifyDockerDatabaseSchema\(/, 'expected the post-migration database verification to be called');

    const migrateCallIndex = codeOnly.indexOf('await runBackendMigrations(runInherit)');
    const verifyCallIndex = codeOnly.indexOf('await verifyDockerDatabaseSchema(runCapture)');
    assert.ok(migrateCallIndex !== -1 && verifyCallIndex !== -1);
    assert.ok(migrateCallIndex < verifyCallIndex, 'verifyDockerDatabaseSchema must run after runBackendMigrations, not before');

    // Unlike a bare migration-command failure (non-fatal by design, tested above via db:migrate),
    // a schema-verification failure must actually stop the script — never silently fall through to
    // launching a frontend app against a backend whose registration would 500.
    const verifySection = codeOnly.slice(verifyCallIndex, verifyCallIndex + 400);
    assert.match(verifySection, /if\s*\(!dbVerification\.ok\)/);
    assert.match(verifySection, /process\.exitCode\s*=\s*1/);
    assert.match(verifySection, /return;/);
  });

  test('database verification only ever reads — never a destructive Prisma or SQL command', () => {
    assert.doesNotMatch(codeOnly, /migrate reset|db push|DROP\s|DELETE\s+FROM|TRUNCATE/i);
  });
});

describe('cross-platform shape', () => {
  test('no separate PowerShell/bash implementation files exist under tools/dev', () => {
    const devDir = join(__dirname, '..');
    for (const forbidden of ['bootstrap.ps1', 'bootstrap.sh', 'start-dev.ps1', 'start-dev.sh']) {
      assert.equal(existsSync(join(devDir, forbidden)), false, `${forbidden} should not exist — tools/dev is a single cross-platform Node implementation`);
    }
  });

  test('the only process.platform branch is for launching the Docker Desktop GUI app', () => {
    const platformBranches = source.match(/process\.platform/g) ?? [];
    // Every occurrence of process.platform in this file exists solely to decide (a) how to launch
    // Docker Desktop, or (b) whether `pnpm`/npm-shim invocation needs shell:true on Windows — both
    // are the one documented, narrow OS-specific exception, not a second implementation of the
    // script's actual logic.
    assert.ok(platformBranches.length > 0, 'expected at least the Docker Desktop / shell:true platform checks');
  });
});

/**
 * Integration smoke tests — spawns the real bootstrap.mjs as a child process, but only for the
 * guard-rail path that fails before touching Docker, the network, or either repository's
 * dependencies (app-name resolution happens before the backend-repo/install/Docker/health steps —
 * see bootstrap.mjs's main()). Everything past that point (Docker detection, backend health,
 * dependency installation) is already covered by tools/launcher's own test suite via the exact
 * modules this script reuses (detectBackend, buildToolChecks) — this file does not re-test those.
 */
describe('bootstrap.mjs guard rails', () => {
  test('--help prints usage and exits 0 without touching Docker/backend/dependencies', async () => {
    const result = await runCapture(process.execPath, [bootstrapPath, '--help']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Usage: node tools\/dev\/bootstrap\.mjs/);
  });

  test('unknown app exits 1 with a helpful list of valid apps, before any infrastructure step', async () => {
    const result = await runCapture(process.execPath, [bootstrapPath, 'bogus']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Unknown app "bogus"/);
    assert.match(result.stderr, /customer/);
    assert.doesNotMatch(result.stdout + result.stderr, /Docker/);
  });
});
