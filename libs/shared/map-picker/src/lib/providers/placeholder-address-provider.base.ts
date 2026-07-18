/* eslint-disable @typescript-eslint/no-unused-vars -- every method below deliberately ignores
   its parameters before throwing; keeping the interface's real parameter list documents the
   intended real signature for whoever wires up the actual SDK. */
import { Subject } from 'rxjs';
import { AddressProviderNotImplementedError, type AddressProvider } from './address-provider';
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
import { captureCurrentPosition } from './geolocation.util';

/**
 * Every method throws `AddressProviderNotImplementedError` except `getCurrentCoordinates()`,
 * which still returns real GPS coordinates (browser Geolocation, not provider-specific) tagged
 * with this provider's name and no address preview — a real SDK integration is only needed for
 * map rendering/geocoding/search, not for reading the device's own GPS.
 */
export abstract class PlaceholderAddressProviderBase implements AddressProvider {
  abstract readonly name: MapProviderName;

  private readonly eventsSubject = new Subject<MapEvent>();
  readonly events$ = this.eventsSubject.asObservable();

  abstract isConfigured(): boolean;

  private notImplemented(method: string): never {
    const error = new AddressProviderNotImplementedError(this.name, method);
    this.eventsSubject.next({ type: 'provider-error', payload: error });
    throw error;
  }

  async loadMap(_options: LoadMapOptions): Promise<void> {
    this.notImplemented('loadMap');
  }

  showMap(_visible: boolean): void {
    this.notImplemented('showMap');
  }

  moveMarker(_position: MapLatLng): void {
    this.notImplemented('moveMarker');
  }

  setCenter(_position: MapLatLng, _zoom?: number): void {
    this.notImplemented('setCenter');
  }

  fitBounds(_bounds: MapBounds): void {
    this.notImplemented('fitBounds');
  }

  async getCurrentCoordinates(): Promise<PickedLocation> {
    const position = await captureCurrentPosition();

    const location: PickedLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude ?? undefined,
      heading: position.coords.heading ?? undefined,
      speed: position.coords.speed ?? undefined,
      timestamp: new Date(position.timestamp).toISOString(),
      provider: this.name,
      locationSource: 'GPS',
    };

    this.eventsSubject.next({ type: 'current-location-retrieved', payload: location });

    return location;
  }

  async reverseGeocode(
    _position: MapLatLng,
  ): Promise<AddressPreview & { formattedAddress?: string; placeId?: string }> {
    this.notImplemented('reverseGeocode');
  }

  async geocode(_address: string): Promise<PlaceDetails> {
    this.notImplemented('geocode');
  }

  async searchAddresses(_query: string): Promise<AddressSearchResult[]> {
    this.notImplemented('searchAddresses');
  }

  async getPlaceDetails(_placeId: string): Promise<PlaceDetails> {
    this.notImplemented('getPlaceDetails');
  }

  calculateBounds(_positions: MapLatLng[]): MapBounds {
    this.notImplemented('calculateBounds');
  }

  destroyMap(): void {
    // No live resources are ever created by a placeholder provider — nothing to clean up.
  }
}
