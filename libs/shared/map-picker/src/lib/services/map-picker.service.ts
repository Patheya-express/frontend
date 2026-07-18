import { Injectable, inject } from '@angular/core';
import { ADDRESS_PROVIDER } from '../providers/address-provider';
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
 * Thin pass-through to the configured `ADDRESS_PROVIDER` — the Store never injects the provider
 * token directly, matching every other feature's Store -> Service -> (SDK/provider) layering.
 */
@Injectable({ providedIn: 'root' })
export class MapPickerService {
  private readonly provider = inject(ADDRESS_PROVIDER);

  readonly events$ = this.provider.events$;

  get providerName(): MapProviderName {
    return this.provider.name;
  }

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  loadMap(options: LoadMapOptions): Promise<void> {
    return this.provider.loadMap(options);
  }

  showMap(visible: boolean): void {
    this.provider.showMap(visible);
  }

  moveMarker(position: MapLatLng): void {
    this.provider.moveMarker(position);
  }

  setCenter(position: MapLatLng, zoom?: number): void {
    this.provider.setCenter(position, zoom);
  }

  fitBounds(bounds: MapBounds): void {
    this.provider.fitBounds(bounds);
  }

  getCurrentCoordinates(): Promise<PickedLocation> {
    return this.provider.getCurrentCoordinates();
  }

  reverseGeocode(position: MapLatLng): Promise<AddressPreview & { formattedAddress?: string; placeId?: string }> {
    return this.provider.reverseGeocode(position);
  }

  geocode(address: string): Promise<PlaceDetails> {
    return this.provider.geocode(address);
  }

  searchAddresses(query: string): Promise<AddressSearchResult[]> {
    return this.provider.searchAddresses(query);
  }

  getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    return this.provider.getPlaceDetails(placeId);
  }

  calculateBounds(positions: MapLatLng[]): MapBounds {
    return this.provider.calculateBounds(positions);
  }

  destroyMap(): void {
    this.provider.destroyMap();
  }
}

export type { MapEvent };
