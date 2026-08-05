import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import * as log from './log.mjs';
import { runInheritCapture } from './exec.mjs';
import { repoRoot } from './registry.mjs';

const CACHE_DIR = join(repoRoot, 'node_modules', '.launcher-cache');

/** Newest mtime across a directory tree — cheap proxy for "did anything in here change since the
 *  last sync" without hashing every file's content. Returns 0 for a missing directory (never
 *  throws — a platform folder that doesn't exist yet just contributes "nothing to watch" rather
 *  than crashing the signature computation). */
function newestMtime(dir) {
  if (!existsSync(dir)) {
    return 0;
  }
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(full) : statSync(full).mtimeMs);
  }
  return newest;
}

function fileHash(path) {
  if (!existsSync(path)) {
    return null;
  }
  return createHash('sha1').update(readFileSync(path)).digest('hex');
}

function capacitorPluginSignature() {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const capacitorDeps = Object.entries(pkg.dependencies ?? {})
    .filter(([name]) => name.startsWith('@capacitor/') || name.includes('capacitor'))
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(capacitorDeps);
}

/**
 * Task 5 — everything that can actually affect what `cap sync` produces, named so a resync can
 * explain *why* it's happening (Task 5: "if nothing affecting native changed: skip sync, explain
 * why" — the inverse, explaining what DID change, is the same information from the other side).
 */
function computeParts(app) {
  const appDir = join(repoRoot, 'apps', app.project);
  return {
    plugins: capacitorPluginSignature(),
    webBundle: String(newestMtime(join(appDir, '..', '..', 'dist', 'apps', app.project, 'browser'))),
    capacitorConfig: fileHash(join(appDir, 'capacitor.config.ts')) ?? '',
    environmentMobile: fileHash(join(appDir, 'src', 'environments', 'environment.mobile.ts')) ?? '',
    androidResources: String(newestMtime(join(appDir, 'android', 'app', 'src', 'main', 'res'))),
    iosResources: String(newestMtime(join(appDir, 'ios', 'App', 'App', 'Assets.xcassets'))),
  };
}

function diffParts(previous, current) {
  if (!previous) {
    return Object.keys(current);
  }
  return Object.keys(current).filter((key) => previous[key] !== current[key]);
}

const PART_LABELS = {
  plugins: 'Capacitor plugin set',
  webBundle: 'built web bundle',
  capacitorConfig: 'capacitor.config.ts',
  environmentMobile: 'environment.mobile.ts',
  androidResources: 'Android resources (res/)',
  iosResources: 'iOS resources (Assets.xcassets)',
};

/**
 * Step 4 — native synchronization. `cap-sync` itself (an `nx:run-commands` target, not a
 * `@nx/*` executor) has no Nx-level output caching, so this adds a lightweight one of its own,
 * tracked per-part (Task 5) so a resync can say *what* changed rather than just *that* something
 * did. Cached per app under node_modules/.launcher-cache; `--clean` bypasses it unconditionally.
 */
export async function syncNative({ app, platform, noSync, clean, verbose }) {
  log.section('Step 4 — Native synchronization');

  if (noSync) {
    log.warn('Skipped (--no-sync).');
    return { ok: true, skipped: true };
  }

  const markerPath = join(CACHE_DIR, `${app.project}-sync.json`);
  const current = computeParts(app);

  let previous = null;
  if (!clean && existsSync(markerPath)) {
    try {
      previous = JSON.parse(readFileSync(markerPath, 'utf8')).parts;
    } catch {
      previous = null; // Corrupt/unreadable marker — treat as "no prior sync recorded".
    }
  }

  const changed = clean ? Object.keys(current) : diffParts(previous, current);

  if (changed.length === 0) {
    log.ok('Nothing affecting native changed since the last sync — skipping.');
    log.detail('(Capacitor plugins, capacitor.config.ts, environment.mobile.ts, native resources, and the web bundle are all unchanged. Use --clean to force.)');
    return { ok: true, skipped: true };
  }

  log.info(`Syncing — changed: ${changed.map((key) => PART_LABELS[key]).join(', ')}.`);

  const result = await runInheritCapture('npx', ['nx', 'run', `${app.project}:cap-sync`, '--configuration=mobile'], {
    cwd: repoRoot,
  });

  if (result.code !== 0) {
    return {
      ok: false,
      rootCause: `Capacitor sync failed for ${app.displayName} (exit code ${result.code ?? 'unknown'}).`,
      suggestedFix: 'See the `cap sync` output above.',
      nextAction: `Re-run in isolation: npx nx run ${app.project}:cap-sync --configuration=mobile${verbose ? ' --verbose' : ''}`,
      retryHint: 'Fix the reported error, then re-run this command — the sync cache was not updated, so it will try again.',
      docs: 'docs/mobile/CAPACITOR.md',
    };
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(markerPath, JSON.stringify({ parts: current, syncedAt: new Date().toISOString() }));
  log.ok(`Capacitor synchronized for ${platform}.`);
  return { ok: true, skipped: false };
}
