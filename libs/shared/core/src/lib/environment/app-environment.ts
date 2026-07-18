import { InjectionToken } from '@angular/core';

/** Every AddressProvider implementation the map picker can be configured to use — see
 *  `libs/shared/map-picker`. Only GOOGLE_MAPS has a real implementation today; the rest are
 *  structurally-complete placeholders pending a real API key/SDK integration. */
export type MapProviderName = 'GOOGLE_MAPS' | 'MAPBOX' | 'HERE_MAPS' | 'OPENSTREETMAP' | 'AZURE_MAPS';

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
}

export const APP_ENVIRONMENT = new InjectionToken<AppEnvironment>('APP_ENVIRONMENT');
