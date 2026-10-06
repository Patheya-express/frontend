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
 * Usage: node scripts/verify-production-env.mjs <app-name> [--mobile-release]
 * Exits 0 (silent) if the file is clean, exits 1 with a descriptive message otherwise.
 *
 * `--mobile-release` adds the store-release gate for the Capacitor shells (customer-app,
 * restaurant-app, delivery-app — `pnpm verify:mobile-release`): production origins must be HTTPS
 * and differ from the app's QA/mobile origins, Sentry and Google Maps must be configured, and
 * `releaseVersion` must match the native versions (Android versionName, iOS MARKETING_VERSION).
 * Not run on every CI push, since a store release legitimately needs values (DSN, Maps key) that
 * plain web/CI builds don't. See docs/mobile/README.md "Production Release Prerequisites".
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

function environmentPath(appName, fileName) {
  return join(repoRoot, 'apps', appName, 'src', 'environments', fileName);
}

/** Reads `key: '<value>'` from an environment file's source — the same regex-extract approach as
 *  the checks above (fileReplacements swaps these files in verbatim, so the source is the truth). */
function readStringField(contents, key) {
  const match = contents.match(new RegExp(`${key}:\\s*['"]([^'"]*)['"]`));
  return match ? match[1] : null;
}

const ORIGIN_FIELDS = ['apiBaseUrl', 'socketUrl', 'mediaBaseUrl'];

function verifyMobileRelease(appName, envPath, contents) {
  const problems = [];

  const nonProductionOrigins = new Set();
  for (const fileName of ['environment.qa.ts', 'environment.mobile.ts']) {
    const path = environmentPath(appName, fileName);
    if (existsSync(path)) {
      const other = readFileSync(path, 'utf8');
      for (const field of ORIGIN_FIELDS) {
        const value = readStringField(other, field);
        if (value) nonProductionOrigins.add(value);
      }
    }
  }

  for (const field of ORIGIN_FIELDS) {
    const value = readStringField(contents, field) ?? '';
    if (!value.startsWith('https://')) {
      problems.push(
        `${envPath}: ${field} must be an https:// production origin (found "${value}").`,
      );
    } else if (nonProductionOrigins.has(value)) {
      problems.push(
        `${envPath}: ${field} (${value}) is the same origin as this app's QA/mobile environment — production must use its own backend.`,
      );
    }
  }

  if (!readStringField(contents, 'sentryDsn')) {
    problems.push(
      `${envPath}: sentryDsn is empty — crash reporting would be disabled in the store build.`,
    );
  }
  if (!readStringField(contents, 'googleMapsApiKey')) {
    problems.push(
      `${envPath}: maps.googleMapsApiKey is empty — the address/map picker would be unavailable.`,
    );
  }

  // Android push (FCM) needs this app's own Firebase config; it cannot be generated here — it is
  // downloaded from the Firebase console for the app's package name.
  const servicesJsonPath = join(
    repoRoot,
    'apps',
    appName,
    'android',
    'app',
    'google-services.json',
  );
  const gradleSource = existsSync(
    join(repoRoot, 'apps', appName, 'android', 'app', 'build.gradle'),
  )
    ? readFileSync(
        join(repoRoot, 'apps', appName, 'android', 'app', 'build.gradle'),
        'utf8',
      )
    : '';
  const applicationId = gradleSource.match(/applicationId\s+"([^"]+)"/)?.[1];
  if (applicationId) {
    const packages = existsSync(servicesJsonPath)
      ? (JSON.parse(readFileSync(servicesJsonPath, 'utf8')).client?.map(
          (client) => client.client_info?.android_client_info?.package_name,
        ) ?? [])
      : null;
    if (packages === null) {
      problems.push(
        `${servicesJsonPath} is missing — Android push notifications (FCM) cannot work without it.`,
      );
    } else if (!packages.includes(applicationId)) {
      problems.push(
        `${servicesJsonPath} has no client for "${applicationId}" — download it from the Firebase console for that package.`,
      );
    }
  }

  const releaseVersion = readStringField(contents, 'releaseVersion');
  const gradlePath = join(
    repoRoot,
    'apps',
    appName,
    'android',
    'app',
    'build.gradle',
  );
  const pbxprojPath = join(
    repoRoot,
    'apps',
    appName,
    'ios',
    'App',
    'App.xcodeproj',
    'project.pbxproj',
  );
  const versionName = existsSync(gradlePath)
    ? readFileSync(gradlePath, 'utf8').match(/versionName\s+"([^"]+)"/)?.[1]
    : undefined;
  const marketingVersions = existsSync(pbxprojPath)
    ? [
        ...new Set(
          [
            ...readFileSync(pbxprojPath, 'utf8').matchAll(
              /MARKETING_VERSION = ([^;]+);/g,
            ),
          ].map((m) => m[1]),
        ),
      ]
    : [];
  if (versionName !== undefined && versionName !== releaseVersion) {
    problems.push(
      `releaseVersion "${releaseVersion}" (${envPath}) != Android versionName "${versionName}" (${gradlePath}).`,
    );
  }
  if (marketingVersions.some((version) => version !== releaseVersion)) {
    problems.push(
      `releaseVersion "${releaseVersion}" (${envPath}) != iOS MARKETING_VERSION ${marketingVersions.join('/')} (${pbxprojPath}).`,
    );
  }

  return problems;
}

function verifyApp(appName, { mobileRelease = false } = {}) {
  return PRODUCTION_ENVIRONMENT_FILES.flatMap((file) =>
    verifyFile(appName, environmentPath(appName, file), { mobileRelease }),
  );
}

function verifyFile(appName, envPath, { mobileRelease }) {
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

  if (mobileRelease) {
    problems.push(...verifyMobileRelease(appName, envPath, contents));
  }

  return problems;
}

function main() {
  const [appName, ...flags] = process.argv.slice(2);
  const unknownFlags = flags.filter((flag) => flag !== '--mobile-release');

  if (!appName || unknownFlags.length > 0) {
    console.error(
      'Usage: node scripts/verify-production-env.mjs <app-name> [--mobile-release]',
    );
    process.exit(1);
  }

  const mobileRelease = flags.includes('--mobile-release');
  const problems = verifyApp(appName, { mobileRelease });

  if (problems.length > 0) {
    console.error(`✖ Production config check failed for "${appName}":\n`);
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    console.error('');
    process.exit(1);
  }

  console.log(
    `✔ ${mobileRelease ? 'Mobile store-release' : 'Production'} config check passed for "${appName}".`,
  );
}

main();
