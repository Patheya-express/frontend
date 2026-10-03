#!/usr/bin/env node
/**
 * Production build-time configuration injection.
 *
 * The committed Production environment files (`environment.prod.ts`, `environment.mobile.prod.ts`)
 * never contain the live Razorpay key ID — they carry the placeholder
 * `REPLACE_WITH_RAZORPAY_LIVE_KEY_ID`, which `verify-production-env.mjs` rejects. A Production
 * build (CI, or a release machine building the native apps) runs this script first, in its own
 * ephemeral checkout, to substitute the value of the `RAZORPAY_LIVE_KEY_ID` environment variable
 * (a CI build secret), then runs `verify-production-env.mjs`, then builds.
 *
 * A Razorpay key ID is public-by-design once shipped in a client bundle; it is kept out of the
 * repository so the live value is managed in one place (the build secret) and a missing value
 * fails the build instead of silently shipping a placeholder or a test key.
 *
 * Usage: RAZORPAY_LIVE_KEY_ID=rzp_live_... node scripts/inject-production-env.mjs <app> [<app>...]
 * Files without the placeholder are left untouched. Never prints the key.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const PRODUCTION_ENVIRONMENT_FILES = [
  'environment.prod.ts',
  'environment.mobile.prod.ts',
];

const RAZORPAY_PLACEHOLDER = 'REPLACE_WITH_RAZORPAY_LIVE_KEY_ID';
const LIVE_KEY_PATTERN = /^rzp_live_[A-Za-z0-9]+$/;

function main() {
  const apps = process.argv.slice(2);

  if (apps.length === 0) {
    console.error(
      'Usage: RAZORPAY_LIVE_KEY_ID=rzp_live_... node scripts/inject-production-env.mjs <app> [<app>...]',
    );
    process.exit(1);
  }

  const liveKeyId = (process.env.RAZORPAY_LIVE_KEY_ID ?? '').trim();
  let injected = 0;

  for (const app of apps) {
    for (const file of PRODUCTION_ENVIRONMENT_FILES) {
      const envPath = join(repoRoot, 'apps', app, 'src', 'environments', file);

      if (!existsSync(envPath)) {
        continue;
      }

      const contents = readFileSync(envPath, 'utf8');

      if (!contents.includes(RAZORPAY_PLACEHOLDER)) {
        continue;
      }

      if (!LIVE_KEY_PATTERN.test(liveKeyId)) {
        console.error(
          `✖ ${envPath} needs the live Razorpay key ID, but RAZORPAY_LIVE_KEY_ID is ${
            liveKeyId ? 'not a live key (rzp_live_...)' : 'not set'
          }.`,
        );
        process.exit(1);
      }

      writeFileSync(
        envPath,
        contents.split(RAZORPAY_PLACEHOLDER).join(liveKeyId),
        'utf8',
      );
      injected += 1;
      console.log(`✔ Injected the live Razorpay key ID into ${envPath}.`);
    }
  }

  if (injected === 0) {
    console.log('No Production build-time placeholders found — nothing to inject.');
  }
}

main();
