import { Injectable, inject } from '@angular/core';
import { APP_ENVIRONMENT } from '@patheya-express-frontend/core';
import type { MapProviderName } from '../../models/map-picker.models';
import { PlaceholderAddressProviderBase } from '../placeholder-address-provider.base';

/**
 * Placeholder — Mapbox GL JS is not yet integrated. `isConfigured()` reflects whether an access
 * token has been supplied, but every map/geocoding method still throws until the real `mapbox-gl`
 * SDK is wired in here (see GoogleMapsAddressProvider for the pattern to follow).
 */
@Injectable({ providedIn: 'root' })
export class MapboxAddressProvider extends PlaceholderAddressProviderBase {
  readonly name: MapProviderName = 'MAPBOX';

  private readonly environment = inject(APP_ENVIRONMENT);

  isConfigured(): boolean {
    return !!this.environment.maps.mapboxAccessToken;
  }
}
