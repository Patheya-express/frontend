import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AddressPreview,
  AddressSearchResult,
  LoadMapOptions,
  MapBounds,
  MapEvent,
  MapLatLng,
  MapProviderName,
  PickedLocation,
  PlaceDetails,
} from '../models/map-picker.models';

/**
 * The single seam between every map-picker consumer (component/store/facade) and an actual map
 * SDK. Nothing outside a `*AddressProvider` implementation may reference `google.maps`,
 * `mapboxgl`, `H` (HERE), Azure Maps globals, or Leaflet directly — see PADK map-picker doc.
 * Swapping providers is a `MapProviderConfig.provider` config change only.
 */
export interface AddressProvider {
  readonly name: MapProviderName;

  /** True once the provider has everything it needs (API key/token) to actually function. */
  isConfigured(): boolean;

  /** Fires every provider/map lifecycle event — see `MapEventType` for the full list. */
  readonly events$: Observable<MapEvent>;

  loadMap(options: LoadMapOptions): Promise<void>;
  showMap(visible: boolean): void;
  moveMarker(position: MapLatLng): void;
  setCenter(position: MapLatLng, zoom?: number): void;
  fitBounds(bounds: MapBounds): void;
  getCurrentCoordinates(): Promise<PickedLocation>;
  reverseGeocode(position: MapLatLng): Promise<AddressPreview & { formattedAddress?: string; placeId?: string }>;
  geocode(address: string): Promise<PlaceDetails>;
  searchAddresses(query: string): Promise<AddressSearchResult[]>;
  getPlaceDetails(placeId: string): Promise<PlaceDetails>;
  calculateBounds(positions: MapLatLng[]): MapBounds;
  destroyMap(): void;
}

export const ADDRESS_PROVIDER = new InjectionToken<AddressProvider>('ADDRESS_PROVIDER');

/** Thrown by every placeholder provider — a clear, typed signal (rather than a silent no-op)
 *  that a given provider still needs its real SDK integration wired in. */
export class AddressProviderNotImplementedError extends Error {
  constructor(provider: MapProviderName, method: string) {
    super(`${provider} does not yet implement ${method}() — this is a placeholder AddressProvider.`);
    this.name = 'AddressProviderNotImplementedError';
  }
}
