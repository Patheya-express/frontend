import * as Sentry from '@sentry/capacitor';
import { init as sentryAngularInit } from '@sentry/angular';
import type { ObservabilityConfig } from './observability-config';
import { scrubSentryBreadcrumb, scrubSentryEvent } from './sentry-event-scrubbing';

let initialized = false;

/**
 * Initializes crash reporting. Called once, as a plain function, at the very top of each app's
 * `main.ts` — before `bootstrapApplication()` — rather than through Angular DI (an `APP_INITIALIZER`
 * runs only after the environment injector already exists, so it would miss a failure in
 * bootstrapping itself; this mirrors Sentry's own documented Angular+Capacitor setup pattern of
 * calling `Sentry.init()` before the app bootstraps).
 *
 * Synchronous and side-effect-only — never awaited, never blocks startup. Wrapped so that any
 * failure (malformed config, the native bridge not being ready, anything) is swallowed rather than
 * thrown: crash reporting failing to start must never stop the app from starting. Idempotent (a
 * second call is a no-op) so it's safe to call from a test harness or a hot-reload scenario without
 * double-registering.
 *
 * A blank `dsn` (no Sentry project provisioned yet for this app/environment — see
 * `AppEnvironment.sentryDsn`'s doc comment) intentionally skips initialization entirely: no network
 * calls, no native SDK activity, nothing to fail later.
 */
export function initMobileObservability(config: ObservabilityConfig): void {
  if (initialized) {
    return;
  }
  initialized = true;

  if (!config.dsn) {
    return;
  }

  try {
    Sentry.init(
      {
        dsn: config.dsn,
        environment: config.environmentName,
        release: `${config.app}@${config.releaseVersion}`,
        // M7 is crash/error reporting only — no performance tracing (M7.20/W in static
        // verification explicitly rule this out).
        tracesSampleRate: 0,
        sendDefaultPii: false,
        beforeSend: (event) => scrubSentryEvent(event),
        beforeBreadcrumb: (breadcrumb) => scrubSentryBreadcrumb(breadcrumb),
      },
      sentryAngularInit,
    );
    Sentry.setTag('app', config.app);
  } catch {
    // Never let observability bring the app down with it.
  }
}

/** Best-effort report of a bootstrap-time failure — `bootstrapApplication()` itself failed, so no
 *  Angular ErrorHandler exists yet to catch it. Falls back silently if Sentry never initialized
 *  (blank DSN, or `initMobileObservability` wasn't called/failed) — the caller's own
 *  `console.error(err)` remains the guaranteed fallback either way. */
export function reportBootstrapFailure(error: unknown): void {
  try {
    Sentry.captureException(error);
  } catch {
    // Reporting the failure must never itself throw.
  }
}

/** Test-only escape hatch — resets the module-level idempotency guard between test cases. */
export function resetMobileObservabilityForTesting(): void {
  initialized = false;
}
