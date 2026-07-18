import { Injectable } from '@angular/core';
import type { MapProviderName } from '../../models/map-picker.models';
import { PlaceholderAddressProviderBase } from '../placeholder-address-provider.base';

/**
 * Placeholder — OpenStreetMap/Leaflet needs no API key (this repo already has a working,
 * zero-config Leaflet integration for live order tracking — see
 * `libs/shared/core/src/lib/map/map.service.ts` — so wiring this provider up for the map picker
 * is the cheapest of the four placeholders to finish), but the interactive-picker behaviors
 * (draggable marker, Nominatim reverse-geocode/search) aren't implemented yet, so every method
 * below still throws. `isConfigured()` always returns true since there's nothing to configure.
 */
@Injectable({ providedIn: 'root' })
export class OpenStreetMapAddressProvider extends PlaceholderAddressProviderBase {
  readonly name: MapProviderName = 'OPENSTREETMAP';

  isConfigured(): boolean {
    return true;
  }
}
