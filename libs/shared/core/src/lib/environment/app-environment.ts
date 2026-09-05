import { InjectionToken } from '@angular/core';

/** Every AddressProvider implementation the map picker can be configured to use — see
 *  `libs/shared/map-picker`. Only GOOGLE_MAPS has a real implementation today; the rest are
 *  structurally-complete placeholders pending a real API key/SDK integration. */
export type MapProviderName =
  | 'GOOGLE_MAPS'
  | 'MAPBOX'
  | 'HERE_MAPS'
  | 'OPENSTREETMAP'
  | 'AZURE_MAPS';

/** Selects the active map provider and carries every provider's credentials — switching
 *  providers is a config-only change, never a code change (see map-picker's provider factory). */
export interface MapProviderConfig {
  provider: MapProviderName;
  googleMapsApiKey?: string;
  mapboxAccessToken?: string;
  hereMapsApiKey?: string;
  azureMapsKey?: string;
}

/**
 * Per-app, build-time configuration — populated from each app's own `src/environments/*.ts`
 * via Angular file replacements (development/staging/production), never hardcoded in service
 * code. Every app provides this once in its `app.config.ts`:
 *
 *   { provide: APP_ENVIRONMENT, useValue: environment }
 */
export interface AppEnvironment {
  production: boolean;
  apiBaseUrl: string;
  socketUrl: string;
  mediaBaseUrl: string;
  razorpayKeyId: string;
  maps: MapProviderConfig;
  /**
   * M7: distinguishes development/qa/staging/production for crash-reporting context — `production`
   * above cannot do this alone, since `environment.qa.ts`, `.staging.ts`, `.prod.ts` and
   * `.mobile.ts` all set `production: true` (only local `environment.ts` sets it `false`). Optional
   * so apps that don't opt into observability (e.g. admin-app, web-only per M6/M7 scope) don't need
   * to add it.
   */
  environmentName?: 'development' | 'qa' | 'staging' | 'production';
  /**
   * M7: the current native versionName (Android) / MARKETING_VERSION (iOS) for this app, mirrored
   * here so it's available synchronously at bootstrap for crash-report release identification
   * without an async native call. Manually kept in sync with `android/app/build.gradle` and
   * `ios/App/App.xcodeproj/project.pbxproj` — the same manual-sync state those two already have
   * with each other today (see M7's audit note on hardcoded native versions; automating this is
   * M9 work, not invented here).
   */
  releaseVersion?: string;
  /**
   * M7: this app's Sentry DSN. A DSN is a public, non-secret identifier by Sentry's own design
   * (safe to ship in a client bundle) — see https://docs.sentry.io/product/sentry-basics/dsn-explainer/.
   * Left empty here deliberately: no real Sentry project has been provisioned as part of this
   * change. Crash reporting no-ops (logs a warning once, never throws) until a real DSN is set.
   */
  sentryDsn?: string;
}

export const APP_ENVIRONMENT = new InjectionToken<AppEnvironment>(
  'APP_ENVIRONMENT',
);
