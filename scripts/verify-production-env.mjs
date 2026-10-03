#!/usr/bin/env node
/**
 * Sprint 1.6 — production configuration & secrets hardening.
 *
 * `apps/customer-app/src/environments/environment.prod.ts` (and `environment.mobile.prod.ts`)
 * ship the placeholder `REPLACE_WITH_RAZORPAY_LIVE_KEY_ID`, substituted at build time by
 * `inject-production-env.mjs` from the RAZORPAY_LIVE_KEY_ID build secret. This script is the
 * enforcement: it reads the *source* environment files for the given app (not a built
 * bundle — simpler and equally reliable, since fileReplacements swaps this exact file in
 * verbatim for a `--configuration=production` build) and fails with a clear, specific message if
 * it still contains an unedited placeholder, a `localhost`/127.0.0.1 URL, or (for any app that
 * uses Razorpay) a test key where a live key is expected.
 *
 * Usage: node scripts/verify-production-env.mjs <app-name>
 * Exits 0 (silent) if the file is clean, exits 1 with a descriptive message otherwise.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const PLACEHOLDER_PATTERNS = [
  /REPLACE_WITH/i,
  /REPLACE-WITH/i,
  /CHANGEME/i,
  /CHANGE-ME/i,
  /YOUR[-_]SECRET/i,
  /\bTODO\b/,
  /\bFIXME\b/,
];

const LOCALHOST_PATTERN = /https?:\/\/(localhost|127\.0\.0\.1)/i;

/** A Razorpay key ID is public-by-design (not a secret — see infrastructure/docs/secrets-guide.md),
 *  so this isn't a secret-leakage check; it's a "wrong environment value" check: a test key
 *  (`rzp_test_...`) accidentally left in a production build silently makes checkout fail
 *  end-to-end, and nothing else in the pipeline would catch that before a real user does. */
const TEST_RAZORPAY_KEY_PATTERN = /rzp_test_/;

/** Every Production environment file an app may have — the web build (`environment.prod.ts`)
 *  and, for the Capacitor apps, the Production native build (`environment.mobile.prod.ts`). */
const PRODUCTION_ENVIRONMENT_FILES = [
  'environment.prod.ts',
  'environment.mobile.prod.ts',
];

function verifyApp(appName) {
  return PRODUCTION_ENVIRONMENT_FILES.flatMap((file) =>
    verifyFile(join(repoRoot, 'apps', appName, 'src', 'environments', file)),
  );
}

function verifyFile(envPath) {
  if (!existsSync(envPath)) {
    // Not every app has every file (admin-app has no native build), and a future app without a
    // production environment file — e.g. an internal tool — shouldn't fail this check.
    return [];
  }

  const contents = readFileSync(envPath, 'utf8');
  const problems = [];

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(contents)) {
      problems.push(
        `${envPath} still contains an unedited placeholder value matching ${pattern} — replace it with the real production value before deploying.`,
      );
    }
  }

  if (LOCALHOST_PATTERN.test(contents)) {
    problems.push(
      `${envPath} contains a localhost/127.0.0.1 URL — a production environment file must never point at a local dev server.`,
    );
  }

  if (TEST_RAZORPAY_KEY_PATTERN.test(contents)) {
    problems.push(
      `${envPath} contains a Razorpay TEST key (rzp_test_...) — production must use a LIVE key (rzp_live_...).`,
    );
  }

  return problems;
}

function main() {
  const appName = process.argv[2];

  if (!appName) {
    console.error('Usage: node scripts/verify-production-env.mjs <app-name>');
    process.exit(1);
  }

  const problems = verifyApp(appName);

  if (problems.length > 0) {
    console.error(`✖ Production config check failed for "${appName}":\n`);
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    console.error('');
    process.exit(1);
  }

  console.log(`✔ Production config check passed for "${appName}".`);
}

main();
