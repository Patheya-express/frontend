import { Injectable, inject } from '@angular/core';
import { APP_ENVIRONMENT } from '@patheya-express-frontend/core';
import type { MapProviderName } from '../../models/map-picker.models';
import { PlaceholderAddressProviderBase } from '../placeholder-address-provider.base';

/**
 * Placeholder — HERE Maps JS SDK is not yet integrated. `isConfigured()` reflects whether an API
 * key has been supplied, but every map/geocoding method still throws until the real HERE SDK is
 * wired in here (see GoogleMapsAddressProvider for the pattern to follow).
 */
@Injectable({ providedIn: 'root' })
export class HereMapsAddressProvider extends PlaceholderAddressProviderBase {
  readonly name: MapProviderName = 'HERE_MAPS';

  private readonly environment = inject(APP_ENVIRONMENT);

  isConfigured(): boolean {
    return !!this.environment.maps.hereMapsApiKey;
  }
}
