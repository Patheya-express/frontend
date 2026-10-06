#!/usr/bin/env node
/**
 * Production build-artifact verification — the built-output counterpart of
 * `verify-production-env.mjs` (which checks the *source* environment files). Run after
 * `nx build <app> --configuration=production`; scans every text file under
 * `dist/apps/<app>/browser` and fails if the bundle:
 *
 *   - contains a localhost / 127.0.0.1 URL, a Render (onrender.com) origin, a Razorpay TEST key
 *     (rzp_test_...), or an unreplaced `REPLACE_WITH` placeholder;
 *   - does not contain the Production API origin (https://api.patheyaexpress.com);
 *   - (apps whose environment.prod.ts sets razorpayKeyId — customer-app) does not contain that
 *     exact live-format key ID, i.e. build-time injection did not reach the bundle.
 *
 * `--release` (frontend-deploy-web.yml) additionally rejects the CI-only validation key ID that
 * ci.yml injects, so a CI-style build can never pass the deploy gate.
 *
 * Usage: node scripts/verify-production-build.mjs <app-name> [--release]
 * Never prints the key ID.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const PRODUCTION_API_ORIGIN = 'https://api.patheyaexpress.com';

/** Injected by ci.yml for build validation only — never a real credential, never deployed. */
const CI_VALIDATION_RAZORPAY_KEY_ID = 'rzp_live_CIVALIDATIONONLY';

const LIVE_KEY_PATTERN = /^rzp_live_[A-Za-z0-9]+$/;

const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.css', '.html', '.json', '.txt', '.webmanifest', '.svg']);

/** URL forms only: vendor code (socket.io, Sentry) legitimately contains a bare "localhost". */
const FORBIDDEN = [
  { pattern: /\b(?:https?|wss?):\/\/(?:localhost|127\.0\.0\.1)\b/i, label: 'a localhost/127.0.0.1 URL' },
  { pattern: /onrender\.com/i, label: 'a Render (onrender.com) origin' },
  { pattern: /rzp_test_/, label: 'a Razorpay TEST key (rzp_test_...)' },
  { pattern: /REPLACE_WITH/i, label: 'an unreplaced REPLACE_WITH placeholder' },
];

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

/** razorpayKeyId from the (post-injection) production environment file; '' when unused. */
function expectedRazorpayKeyId(appName) {
  const envPath = join(repoRoot, 'apps', appName, 'src', 'environments', 'environment.prod.ts');
  if (!existsSync(envPath)) return '';
  return readFileSync(envPath, 'utf8').match(/razorpayKeyId:\s*['"]([^'"]*)['"]/)?.[1] ?? '';
}

function main() {
  const [appName, ...flags] = process.argv.slice(2);
  const unknownFlags = flags.filter((flag) => flag !== '--release');

  if (!appName || unknownFlags.length > 0) {
    console.error('Usage: node scripts/verify-production-build.mjs <app-name> [--release]');
    process.exit(1);
  }

  const release = flags.includes('--release');
  const distDir = join(repoRoot, 'dist', 'apps', appName, 'browser');

  if (!existsSync(join(distDir, 'index.html'))) {
    console.error(`✖ ${distDir}/index.html not found — build ${appName} with --configuration=production first.`);
    process.exit(1);
  }

  const problems = [];
  const files = listFiles(distDir).filter((file) => TEXT_EXTENSIONS.has(extname(file).toLowerCase()));
  const contents = files.map((file) => ({ file: relative(repoRoot, file), text: readFileSync(file, 'utf8') }));

  for (const { pattern, label } of FORBIDDEN) {
    for (const { file, text } of contents) {
      if (pattern.test(text)) problems.push(`${file} contains ${label}.`);
    }
  }

  if (!contents.some(({ text }) => text.includes(PRODUCTION_API_ORIGIN))) {
    problems.push(`No bundle file references the Production API origin ${PRODUCTION_API_ORIGIN}.`);
  }

  const keyId = expectedRazorpayKeyId(appName);
  if (keyId) {
    if (!LIVE_KEY_PATTERN.test(keyId)) {
      problems.push('environment.prod.ts razorpayKeyId is not a live-format key ID (rzp_live_...) — was inject-production-env.mjs run?');
    } else if (!contents.some(({ text }) => text.includes(keyId))) {
      problems.push('The injected Razorpay key ID is not present in the built bundle.');
    }
    if (release && keyId === CI_VALIDATION_RAZORPAY_KEY_ID) {
      problems.push('The bundle carries the CI-only validation Razorpay key ID — it must never be deployed.');
    }
  }
  if (release && contents.some(({ text }) => text.includes(CI_VALIDATION_RAZORPAY_KEY_ID))) {
    problems.push('A bundle file contains the CI-only validation Razorpay key ID — it must never be deployed.');
  }

  if (problems.length > 0) {
    console.error(`✖ Production build check failed for "${appName}":\n`);
    for (const problem of [...new Set(problems)]) console.error(`  - ${problem}`);
    console.error('');
    process.exit(1);
  }

  console.log(
    `✔ Production build check passed for "${appName}" (${files.length} files${keyId ? ', live Razorpay key ID present' : ''}${release ? ', release mode' : ''}).`,
  );
}

main();
