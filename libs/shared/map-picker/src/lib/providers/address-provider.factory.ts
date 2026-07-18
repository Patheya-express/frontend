import type { Provider } from '@angular/core';
import { APP_ENVIRONMENT, type AppEnvironment } from '@patheya-express-frontend/core';
import { ADDRESS_PROVIDER, type AddressProvider } from './address-provider';
import { GoogleMapsAddressProvider } from './google-maps/google-maps-address-provider.service';
import { MapboxAddressProvider } from './mapbox/mapbox-address-provider.service';
import { HereMapsAddressProvider } from './here-maps/here-maps-address-provider.service';
import { OpenStreetMapAddressProvider } from './openstreetmap/openstreetmap-address-provider.service';
import { AzureMapsAddressProvider } from './azure-maps/azure-maps-address-provider.service';

/** Exported for direct unit testing — `provideAddressProvider()` wires this up as the DI
 *  factory, but the selection logic itself has no DI dependencies worth mocking through Angular. */
export function selectAddressProvider(
  environment: AppEnvironment,
  google: GoogleMapsAddressProvider,
  mapbox: MapboxAddressProvider,
  hereMaps: HereMapsAddressProvider,
  openStreetMap: OpenStreetMapAddressProvider,
  azureMaps: AzureMapsAddressProvider,
): AddressProvider {
  switch (environment.maps.provider) {
    case 'MAPBOX':
      return mapbox;
    case 'HERE_MAPS':
      return hereMaps;
    case 'OPENSTREETMAP':
      return openStreetMap;
    case 'AZURE_MAPS':
      return azureMaps;
    case 'GOOGLE_MAPS':
    default:
      return google;
  }
}

/**
 * Registers whichever `AddressProvider` `environment.maps.provider` names as the app-wide
 * `ADDRESS_PROVIDER` — every consuming app calls this once in `app.config.ts`. Switching
 * providers everywhere that app is deployed is then a one-line change to that app's
 * `environment.ts`, never a code change.
 */
export function provideAddressProvider(): Provider {
  return {
    provide: ADDRESS_PROVIDER,
    useFactory: selectAddressProvider,
    deps: [
      APP_ENVIRONMENT,
      GoogleMapsAddressProvider,
      MapboxAddressProvider,
      HereMapsAddressProvider,
      OpenStreetMapAddressProvider,
      AzureMapsAddressProvider,
    ],
  };
}
