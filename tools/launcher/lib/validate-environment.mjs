import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as log from './log.mjs';
import { commandExists, runCapture } from './exec.mjs';
import { repoRoot, environmentFilePath, readEnvironmentFile } from './registry.mjs';

const MIN_NODE_MAJOR = 20;

export const DOCS = {
  pnpm: 'https://pnpm.io/installation',
  nx: 'https://nx.dev/getting-started/installation',
  android: 'https://developer.android.com/studio/install',
  java: 'https://developer.android.com/build/jdks',
  xcode: 'https://developer.apple.com/xcode/',
  cocoapods: 'https://guides.cocoapods.org/using/getting-started.html',
  docker: 'https://docs.docker.com/get-docker/',
  git: 'https://git-scm.com/downloads',
  gh: 'https://cli.github.com/',
  secrets: 'infrastructure/docs/secrets-guide.md',
  environment: 'infrastructure/docs/environment-guide.md',
  mobile: 'docs/mobile/CAPACITOR.md',
  localDev: 'infrastructure/docs/local-development-guide.md',
};

function parsePnpmVersion(pkgManagerField) {
  const match = /^pnpm@([\d.]+)/.exec(pkgManagerField ?? '');
  return match ? match[1] : null;
}

/** Check descriptor: {label, severity: 'error'|'warning', shouldRun, run}. `run` resolves to
 *  {ok, detail, docs} — never throws (a check that can't determine an answer reports ok:false
 *  with an explanatory detail, never silently omits itself, per Task 2's "never fail silently"). */
function check({ label, severity = 'error', shouldRun = true, run }) {
  return { label, severity, shouldRun, run };
}

/**
 * Checks that depend on the machine/toolchain and target platform, but not on any specific app —
 * Node/pnpm/Nx/git/gh/Docker always; Java/Gradle/Android SDK/Xcode/CocoaPods only for the platform
 * that actually needs them. Split out from the app-specific checks below (Task 1: "no duplicate
 * mappings anywhere") so both validateEnvironment (one app) and doctor (every app) can build their
 * check list from the same source instead of two copies drifting apart.
 */
export function buildToolChecks({ platform }) {
  // 'all' (used by doctor.mjs, which has no single target platform to check against) runs every
  // platform-specific check at once rather than none of them.
  const isAndroid = platform === 'android' || platform === 'all';
  const isIos = platform === 'ios' || platform === 'all';
  const isMac = process.platform === 'darwin';

  return [
    check({
      label: `Node.js ${process.version}`,
      run: async () => {
        const major = Number(process.versions.node.split('.')[0]);
        return {
          ok: major >= MIN_NODE_MAJOR,
          detail: major >= MIN_NODE_MAJOR ? null : `Requires Node ${MIN_NODE_MAJOR}+ (CI pins Node 24 — see .github/workflows/ci.yml).`,
        };
      },
    }),

    check({
      label: 'pnpm',
      run: async () => {
        const available = await commandExists('pnpm');
        if (!available) {
          return { ok: false, detail: 'pnpm is not on PATH. Install it: npm install -g pnpm.', docs: DOCS.pnpm };
        }
        const pkgJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
        const expected = parsePnpmVersion(pkgJson.packageManager);
        return { ok: true, detail: expected ? `workspace pins ${expected}` : null };
      },
    }),

    check({
      label: 'Nx workspace (nx.json)',
      run: async () => {
        const exists = existsSync(join(repoRoot, 'nx.json'));
        return { ok: exists, detail: exists ? null : 'nx.json not found at the repository root — is this the right directory?' };
      },
    }),

    check({
      label: 'Nx version',
      severity: 'warning',
      run: async () => {
        try {
          const nxPkg = JSON.parse(readFileSync(join(repoRoot, 'node_modules', 'nx', 'package.json'), 'utf8'));
          return { ok: true, detail: nxPkg.version };
        } catch {
          return { ok: false, detail: 'Could not read node_modules/nx/package.json — has `pnpm install` run?', docs: DOCS.nx };
        }
      },
    }),

    check({
      label: 'Dependencies installed (node_modules)',
      run: async () => {
        const exists = existsSync(join(repoRoot, 'node_modules'));
        return { ok: exists, detail: exists ? null : 'Run `pnpm install` first.' };
      },
    }),

    check({
      label: 'Git',
      run: async () => {
        const result = await runCapture('git', ['--version']);
        return { ok: !result.error, detail: result.error ? 'git not found on PATH.' : null, docs: DOCS.git };
      },
    }),

    check({
      label: 'GitHub CLI (gh)',
      severity: 'warning',
      run: async () => {
        const available = await commandExists('gh');
        return { ok: available, detail: available ? null : 'Optional — only needed for `gh` workflow commands.', docs: DOCS.gh };
      },
    }),

    check({
      label: 'Docker',
      severity: 'warning',
      run: async () => {
        const available = await commandExists('docker');
        return {
          ok: available,
          detail: available ? null : 'Only needed if the launcher auto-starts the local backend (see Step 2).',
          docs: DOCS.docker,
        };
      },
    }),

    check({
      label: 'Java (for Gradle)',
      shouldRun: isAndroid,
      run: async () => {
        // `java -version` writes to stderr by long-standing convention, not stdout.
        const result = await runCapture('java', ['-version']);
        const output = `${result.stdout}${result.stderr}`;
        const versionMatch = output.match(/version "(\d+)/);
        if (result.error || !versionMatch) {
          return { ok: false, detail: 'java not found on PATH — required by the Gradle wrapper.', docs: DOCS.java };
        }
        return { ok: true, detail: `version ${versionMatch[1]}` };
      },
    }),

    check({
      label: 'Android SDK (adb on PATH)',
      shouldRun: isAndroid,
      run: async () => {
        const available = await commandExists('adb');
        return {
          ok: available,
          detail: available ? null : 'adb not found. Install Android Studio / the Android SDK command-line tools.',
          docs: DOCS.android,
        };
      },
    }),

    check({
      label: 'ANDROID_HOME / ANDROID_SDK_ROOT',
      shouldRun: isAndroid,
      run: async () => {
        const value = process.env['ANDROID_HOME'] || process.env['ANDROID_SDK_ROOT'];
        return { ok: !!value, detail: value ? null : 'Neither is set — Gradle may fail to locate the SDK.', docs: DOCS.android };
      },
    }),

    check({
      label: 'Xcode',
      shouldRun: isIos,
      run: async () => {
        if (!isMac) {
          return { ok: false, detail: `iOS development requires macOS — this machine reports "${process.platform}".`, docs: DOCS.xcode };
        }
        const available = await commandExists('xcodebuild', '-version');
        return { ok: available, detail: available ? null : 'xcodebuild not found. Run `xcode-select --install`.', docs: DOCS.xcode };
      },
    }),

    check({
      label: 'CocoaPods',
      shouldRun: isIos && isMac,
      run: async () => {
        const available = await commandExists('pod');
        return { ok: available, detail: available ? null : 'pod not found. `sudo gem install cocoapods`.', docs: DOCS.cocoapods };
      },
    }),
  ];
}

/** Checks specific to one app (its environment files, native project, and config values) — the
 *  other half of the split described on buildToolChecks(). */
export function buildAppChecks({ app, platform, envName }) {
  const isAndroid = (platform === 'android' || platform === 'all') && app.platforms.android;
  const isIos = (platform === 'ios' || platform === 'all') && app.platforms.ios;

  return [
    check({
      label: `${app.displayName} environment files`,
      run: async () => {
        const exists = existsSync(join(repoRoot, 'apps', app.project, 'src', 'environments', 'environment.ts'));
        return { ok: exists, detail: exists ? null : `Missing apps/${app.project}/src/environments/environment.ts.` };
      },
    }),

    check({
      label: `environment.${envName} config file`,
      shouldRun: envName !== 'local',
      run: async () => {
        const envPath = environmentFilePath(app.project, envName);
        const exists = !!envPath && existsSync(envPath);
        return { ok: exists, detail: exists ? null : `Missing ${envPath}.` };
      },
    }),

    check({
      label: 'Capacitor configuration',
      shouldRun: isAndroid || isIos,
      run: async () => {
        const exists = existsSync(join(repoRoot, 'apps', app.project, 'capacitor.config.ts'));
        return { ok: exists, detail: exists ? null : `Missing apps/${app.project}/capacitor.config.ts.`, docs: DOCS.mobile };
      },
    }),

    check({
      label: 'Android native project',
      shouldRun: isAndroid,
      run: async () => {
        const exists = existsSync(join(repoRoot, 'apps', app.project, 'android'));
        return {
          ok: exists,
          detail: exists ? null : `Missing apps/${app.project}/android/. Run: npx cap add android (from apps/${app.project}).`,
          docs: DOCS.mobile,
        };
      },
    }),

    check({
      label: 'iOS native project',
      shouldRun: isIos,
      run: async () => {
        const exists = existsSync(join(repoRoot, 'apps', app.project, 'ios'));
        return {
          ok: exists,
          detail: exists ? null : `Missing apps/${app.project}/ios/. Run: npx cap add ios (from apps/${app.project}).`,
          docs: DOCS.mobile,
        };
      },
    }),

    check({
      label: 'Gradle wrapper',
      shouldRun: isAndroid,
      run: async () => {
        const wrapper = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
        const exists = existsSync(join(repoRoot, 'apps', app.project, 'android', wrapper));
        return {
          ok: exists,
          detail: exists ? null : `Missing apps/${app.project}/android/${wrapper} — the Android project may not be generated yet.`,
        };
      },
    }),

    check({
      label: 'Google Maps configuration',
      run: async () => {
        const env = readEnvironmentFile(app.project, envName);
        if (!env) {
          return { ok: false, detail: 'Could not read the environment file to check.', docs: DOCS.environment };
        }
        const match = env.contents.match(/googleMapsApiKey:\s*['"]([^'"]*)['"]/);
        const key = match?.[1] ?? '';
        return { ok: key.length > 0, detail: key.length > 0 ? null : 'googleMapsApiKey is empty in the environment file.', docs: DOCS.secrets };
      },
    }),

    check({
      label: 'Firebase configuration',
      severity: 'warning',
      shouldRun: isAndroid || isIos,
      run: async () => {
        const file = isAndroid
          ? join(repoRoot, 'apps', app.project, 'android', 'app', 'google-services.json')
          : join(repoRoot, 'apps', app.project, 'ios', 'App', 'App', 'GoogleService-Info.plist');
        const exists = existsSync(file);
        return {
          ok: exists,
          detail: exists ? null : `Missing (needed for push notifications via FCM/APNs) — see docs/mobile/CAPACITOR.md.`,
          docs: DOCS.mobile,
        };
      },
    }),

    check({
      label: 'Media/Cloudinary base URL',
      severity: 'warning',
      run: async () => {
        const env = readEnvironmentFile(app.project, envName);
        const match = env?.contents.match(/mediaBaseUrl:\s*['"]([^'"]*)['"]/);
        const url = match?.[1] ?? '';
        return { ok: url.length > 0, detail: url.length > 0 ? null : 'mediaBaseUrl is empty — media/asset URLs may not resolve.' };
      },
    }),

    check({
      label: 'Razorpay configuration',
      // Only customer-app actually wires RazorpayCheckoutService into a real checkout flow (see
      // libs/shared/core/src/lib/payments/) — the other three apps carry the field structurally
      // (AppEnvironment requires it) but never consume it, so an empty key there is expected, not
      // a defect. Downgraded to a warning for everyone else rather than a false-positive failure.
      severity: app.alias === 'customer' ? 'error' : 'warning',
      run: async () => {
        const env = readEnvironmentFile(app.project, envName);
        const match = env?.contents.match(/razorpayKeyId:\s*['"]([^'"]*)['"]/);
        const key = match?.[1] ?? '';
        if (key.length === 0) {
          return {
            ok: false,
            detail: app.alias === 'customer' ? 'razorpayKeyId is empty — checkout will fail.' : 'razorpayKeyId is empty (unused by this app).',
            docs: DOCS.secrets,
          };
        }
        return { ok: true, detail: key.startsWith('rzp_test_') ? `${key} (test key)` : key };
      },
    }),

    check({
      label: 'Socket URL',
      run: async () => {
        const env = readEnvironmentFile(app.project, envName);
        const match = env?.contents.match(/socketUrl:\s*\n?\s*['"]([^'"]*)['"]/);
        const url = match?.[1] ?? '';
        return { ok: url.length > 0, detail: url || 'socketUrl is empty in the environment file.' };
      },
    }),

    check({
      label: 'API URL',
      run: async () => {
        const env = readEnvironmentFile(app.project, envName);
        const match = env?.contents.match(/apiBaseUrl:\s*\n?\s*['"]([^'"]*)['"]/);
        const url = match?.[1] ?? '';
        return { ok: url.length > 0, detail: url || 'apiBaseUrl is empty in the environment file.' };
      },
    }),

    check({
      label: 'Environment consistency',
      shouldRun: envName !== 'local',
      run: async () => {
        const env = readEnvironmentFile(app.project, envName);
        if (!env) {
          return { ok: false, detail: 'Could not read the environment file to check.' };
        }
        if (/REPLACE_WITH|CHANGE.?ME|YOUR[-_]SECRET/i.test(env.contents)) {
          return { ok: false, detail: `${env.path} still contains an unedited placeholder value.`, docs: DOCS.secrets };
        }
        if (envName === 'production' && /https?:\/\/(localhost|127\.0\.0\.1)/i.test(env.contents)) {
          return { ok: false, detail: `${env.path} points at localhost — not valid for production.`, docs: DOCS.environment };
        }
        return { ok: true, detail: null };
      },
    }),
  ];
}

/** Runs a list of check descriptors concurrently (Task 4), logs each result, and returns the same
 *  {ok, checks, failed, warnings} shape both validateEnvironment and doctor.mjs build on. Doesn't
 *  print a section header itself — callers do that, since doctor groups many of these under one
 *  header per category rather than one per app. */
export async function runChecks(descriptors) {
  const applicable = descriptors.filter((c) => c.shouldRun);
  const results = await Promise.all(
    applicable.map(async (c) => {
      const result = await c.run();
      return { label: c.label, severity: c.severity, ...result };
    }),
  );

  for (const r of results) {
    if (r.ok) {
      log.ok(`${r.label}${r.detail ? ` (${r.detail})` : ''}`);
    } else if (r.severity === 'warning') {
      log.warn(`${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
    } else {
      log.fail(r.label);
      if (r.detail) {
        log.detail(r.detail);
      }
    }
  }

  const failed = results.filter((r) => !r.ok && r.severity !== 'warning');
  const warnings = results.filter((r) => !r.ok && r.severity === 'warning');
  return { ok: failed.length === 0, checks: results, failed, warnings };
}

/**
 * Step 1 — environment validation for one app+platform+environment. Returns
 * { ok: boolean, checks, failed, warnings } — same shape as before Task 2/4 (only errors count
 * toward `ok`/`failed`; warnings are reported but don't block). All applicable checks run
 * concurrently (Task 4) since none of them depend on another's result.
 */
export async function validateEnvironment({ app, platform, envName }) {
  log.section('Step 1 — Environment validation');
  const descriptors = [...buildToolChecks({ platform }), ...buildAppChecks({ app, platform, envName })];
  return runChecks(descriptors);
}
