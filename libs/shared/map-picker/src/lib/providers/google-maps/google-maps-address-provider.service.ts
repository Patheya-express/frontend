/// <reference types="google.maps" />
import { Injectable, inject } from '@angular/core';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { Subject } from 'rxjs';
import { APP_ENVIRONMENT } from '@patheya-express-frontend/core';
import type { AddressProvider } from '../address-provider';
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
} from '../../models/map-picker.models';
import { captureCurrentPosition } from '../geolocation.util';
import { parseGoogleAddressComponents } from './parse-address-components';

const DEBOUNCE_MS = 400;

/**
 * The one real, fully-wired AddressProvider — everything else behind the `AddressProvider`
 * interface is a placeholder. Loads the Maps JavaScript API lazily (only on the first
 * `loadMap()` call, never at app bootstrap) via `@googlemaps/js-api-loader`'s `importLibrary`,
 * so an app that never opens the map picker never pays for the SDK download.
 *
 * Uses the classic `google.maps.Marker` (draggable) rather than `AdvancedMarkerElement` — the
 * latter requires a Map ID provisioned in Google Cloud Console; this keeps "add an API key" the
 * only setup step. Swap to AdvancedMarkerElement later if a Map ID becomes available.
 */
@Injectable({ providedIn: 'root' })
export class GoogleMapsAddressProvider implements AddressProvider {
  readonly name: MapProviderName = 'GOOGLE_MAPS';

  private readonly environment = inject(APP_ENVIRONMENT);
  private readonly eventsSubject = new Subject<MapEvent>();
  readonly events$ = this.eventsSubject.asObservable();

  private mapsLibrary?: google.maps.MapsLibrary;
  private markerCtor?: typeof google.maps.Marker;
  private coreLibrary?: google.maps.CoreLibrary;
  private geocoder?: google.maps.Geocoder;
  private autocompleteService?: google.maps.places.AutocompleteService;
  private placesService?: google.maps.places.PlacesService;
  private map?: google.maps.Map;
  private marker?: google.maps.Marker;
  private container?: HTMLElement;
  private dragDebounceHandle?: ReturnType<typeof setTimeout>;
  private optionsApplied = false;

  isConfigured(): boolean {
    return !!this.environment.maps.googleMapsApiKey;
  }

  async loadMap(options: LoadMapOptions): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Google Maps API key is not configured (maps.googleMapsApiKey).');
    }

    this.container = options.container;

    if (!this.optionsApplied) {
      setOptions({ key: this.environment.maps.googleMapsApiKey ?? '', v: 'weekly' });
      this.optionsApplied = true;
    }

    try {
      const [mapsLibrary, geocodingLibrary, placesLibrary, markerLibrary, coreLibrary] = await Promise.all([
        importLibrary('maps'),
        importLibrary('geocoding'),
        importLibrary('places'),
        importLibrary('marker'),
        importLibrary('core'),
      ]);

      this.mapsLibrary = mapsLibrary;
      this.markerCtor = markerLibrary.Marker;
      this.coreLibrary = coreLibrary;
      this.geocoder = new geocodingLibrary.Geocoder();
      this.autocompleteService = new placesLibrary.AutocompleteService();

      this.map = new mapsLibrary.Map(options.container, {
        center: options.center,
        zoom: options.zoom ?? 15,
        mapTypeControl: options.mapTypeControl ?? true,
        fullscreenControl: options.fullscreenControl ?? true,
        zoomControl: options.zoomControl ?? true,
        streetViewControl: false,
      });

      this.placesService = new placesLibrary.PlacesService(this.map);

      this.eventsSubject.next({ type: 'map-loaded' });

      this.marker = new this.markerCtor({
        map: this.map,
        position: options.center,
        draggable: true,
      });

      this.wireMapEvents();

      this.eventsSubject.next({ type: 'map-ready' });
    } catch (error) {
      this.eventsSubject.next({ type: 'provider-error', payload: error });
      throw error;
    }
  }

  private wireMapEvents(): void {
    if (!this.map || !this.marker) {
      return;
    }

    this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
      const position = event.latLng?.toJSON();
      if (!position) {
        return;
      }
      this.moveMarker(position);
      this.eventsSubject.next({ type: 'map-click', payload: position });
      void this.reverseGeocode(position).then((preview) => {
        this.eventsSubject.next({ type: 'reverse-geocode-completed', payload: { position, preview } });
      });
    });

    this.map.addListener('zoom_changed', () => {
      this.eventsSubject.next({ type: 'zoom-changed', payload: this.map?.getZoom() });
    });

    this.map.addListener('center_changed', () => {
      this.eventsSubject.next({ type: 'center-changed', payload: this.map?.getCenter()?.toJSON() });
    });

    this.marker.addListener('dragstart', () => {
      this.eventsSubject.next({ type: 'marker-drag-start' });
    });

    this.marker.addListener('drag', () => {
      const position = this.marker?.getPosition()?.toJSON();
      if (!position) {
        return;
      }

      if (this.dragDebounceHandle) {
        clearTimeout(this.dragDebounceHandle);
      }

      this.dragDebounceHandle = setTimeout(() => {
        void this.reverseGeocode(position).then((preview) => {
          this.eventsSubject.next({ type: 'reverse-geocode-completed', payload: { position, preview } });
        });
      }, DEBOUNCE_MS);
    });

    this.marker.addListener('dragend', () => {
      const position = this.marker?.getPosition()?.toJSON();
      if (!position) {
        return;
      }

      if (this.dragDebounceHandle) {
        clearTimeout(this.dragDebounceHandle);
      }

      void this.reverseGeocode(position).then((preview) => {
        this.eventsSubject.next({ type: 'marker-drag-end', payload: { position, preview } });
      });
    });
  }

  showMap(visible: boolean): void {
    if (this.container) {
      this.container.style.display = visible ? '' : 'none';
    }
  }

  moveMarker(position: MapLatLng): void {
    this.marker?.setPosition(position);
    this.map?.panTo(position);
  }

  setCenter(position: MapLatLng, zoom?: number): void {
    this.map?.setCenter(position);
    if (zoom !== undefined) {
      this.map?.setZoom(zoom);
    }
    this.marker?.setPosition(position);
  }

  fitBounds(bounds: MapBounds): void {
    this.map?.fitBounds({
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west,
    });
  }

  async getCurrentCoordinates(): Promise<PickedLocation> {
    const position = await captureCurrentPosition();
    const coords: MapLatLng = { lat: position.coords.latitude, lng: position.coords.longitude };

    const preview = await this.reverseGeocode(coords).catch(() => ({}) as AddressPreview);

    const location: PickedLocation = {
      ...coords,
      ...preview,
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
    position: MapLatLng,
  ): Promise<AddressPreview & { formattedAddress?: string; placeId?: string }> {
    if (!this.geocoder) {
      throw new Error('Google Maps has not been loaded yet — call loadMap() first.');
    }

    try {
      const response = await this.geocoder.geocode({ location: position });
      const result = response.results[0];

      if (!result) {
        return {};
      }

      return {
        ...parseGoogleAddressComponents(result.address_components, result.formatted_address),
        placeId: result.place_id,
      };
    } catch (error) {
      this.eventsSubject.next({ type: 'network-error', payload: error });
      throw error;
    }
  }

  async geocode(address: string): Promise<PlaceDetails> {
    if (!this.geocoder) {
      throw new Error('Google Maps has not been loaded yet — call loadMap() first.');
    }

    const response = await this.geocoder.geocode({ address });
    const result = response.results[0];

    if (!result) {
      throw new Error(`No results found for "${address}".`);
    }

    const position = result.geometry.location.toJSON();

    return {
      ...position,
      ...parseGoogleAddressComponents(result.address_components, result.formatted_address),
      placeId: result.place_id,
    };
  }

  async searchAddresses(query: string): Promise<AddressSearchResult[]> {
    if (!this.autocompleteService) {
      throw new Error('Google Maps has not been loaded yet — call loadMap() first.');
    }

    if (!query.trim()) {
      return [];
    }

    const response = await this.autocompleteService.getPlacePredictions({ input: query });

    return response.predictions.map((prediction) => ({
      placeId: prediction.place_id,
      description: prediction.description,
    }));
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    if (!this.placesService) {
      throw new Error('Google Maps has not been loaded yet — call loadMap() first.');
    }

    return new Promise((resolve, reject) => {
      this.placesService?.getDetails(
        { placeId, fields: ['geometry', 'address_component', 'formatted_address'] },
        (result, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !result?.geometry?.location) {
            reject(new Error(`Unable to resolve place details for "${placeId}" (${status}).`));
            return;
          }

          const position = result.geometry.location.toJSON();

          resolve({
            ...position,
            ...parseGoogleAddressComponents(result.address_components, result.formatted_address),
            placeId,
          });

          this.eventsSubject.next({
            type: 'address-selected',
            payload: { placeId, position },
          });
        },
      );
    });
  }

  calculateBounds(positions: MapLatLng[]): MapBounds {
    if (!this.coreLibrary) {
      throw new Error('Google Maps has not been loaded yet — call loadMap() first.');
    }

    const bounds = new this.coreLibrary.LatLngBounds();
    positions.forEach((position) => bounds.extend(position));

    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();

    return {
      north: northEast.lat(),
      east: northEast.lng(),
      south: southWest.lat(),
      west: southWest.lng(),
    };
  }

  destroyMap(): void {
    if (this.dragDebounceHandle) {
      clearTimeout(this.dragDebounceHandle);
    }

    if (this.marker) {
      google.maps.event.clearInstanceListeners(this.marker);
      this.marker.setMap(null);
    }

    if (this.map) {
      google.maps.event.clearInstanceListeners(this.map);
    }

    this.marker = undefined;
    this.map = undefined;
    this.container = undefined;
  }
}
