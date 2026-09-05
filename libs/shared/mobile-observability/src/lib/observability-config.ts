import { InjectionToken } from '@angular/core';

/** The three mobile apps M7 covers — admin-app is web-only and out of scope, same as M6. */
export type ObservabilityApp = 'customer' | 'restaurant' | 'delivery';

/**
 * Everything `initMobileObservability`/`provideMobileObservability` need, sourced from each app's
 * own `AppEnvironment` (see `environmentName`/`releaseVersion`/`sentryDsn` there) plus the literal
 * `app` name — `AppEnvironment` itself doesn't know which app it belongs to.
 */
export interface ObservabilityConfig {
  readonly app: ObservabilityApp;
  readonly environmentName: string;
  readonly releaseVersion: string;
  /** Empty string disables crash reporting entirely (no DSN provisioned yet) — never throws. */
  readonly dsn: string;
}

export const OBSERVABILITY_CONFIG = new InjectionToken<ObservabilityConfig>('OBSERVABILITY_CONFIG');
