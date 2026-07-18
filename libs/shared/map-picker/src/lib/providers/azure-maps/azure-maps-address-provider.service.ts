import { Injectable, inject } from '@angular/core';
import { APP_ENVIRONMENT } from '@patheya-express-frontend/core';
import type { MapProviderName } from '../../models/map-picker.models';
import { PlaceholderAddressProviderBase } from '../placeholder-address-provider.base';

/**
 * Placeholder — Azure Maps Web SDK is not yet integrated. `isConfigured()` reflects whether a
 * subscription key has been supplied, but every map/geocoding method still throws until the real
 * Azure Maps SDK is wired in here (see GoogleMapsAddressProvider for the pattern to follow).
 */
@Injectable({ providedIn: 'root' })
export class AzureMapsAddressProvider extends PlaceholderAddressProviderBase {
  readonly name: MapProviderName = 'AZURE_MAPS';

  private readonly environment = inject(APP_ENVIRONMENT);

  isConfigured(): boolean {
    return !!this.environment.maps.azureMapsKey;
  }
}
