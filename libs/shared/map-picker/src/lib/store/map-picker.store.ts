import { Injectable, type OnDestroy, computed, inject, signal } from '@angular/core';
import { Subject, Subscription, from, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { MapPickerService } from '../services/map-picker.service';
import type {
  AddressPreview,
  AddressSearchResult,
  LocationSource,
  MapEvent,
  MapLatLng,
  PickedLocation,
} from '../models/map-picker.models';

/** Bengaluru, India — a reasonable default center when no existing coordinates are available. */
const DEFAULT_CENTER: MapLatLng = { lat: 12.9716, lng: 77.5946 };

const SEARCH_DEBOUNCE_MS = 300;

interface GpsMeta {
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp?: string;
}

/**
 * Deliberately NOT `providedIn: 'root'` — this store holds one picker instance's map/marker/
 * address state, and must be provided in `MapPickerComponent`'s own `providers` array so Angular
 * creates a fresh instance (and calls `ngOnDestroy` for cleanup) per component instance. The
 * underlying `ADDRESS_PROVIDER` (SDK loading, library handles) stays a root singleton — reused
 * across every open/close of the picker — only this per-open state is instance-scoped.
 */
@Injectable()
export class MapPickerStore implements OnDestroy {
  private readonly service = inject(MapPickerService);

  private readonly _mapReady = signal(false);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _markerPosition = signal<MapLatLng | null>(null);
  private readonly _addressPreview = signal<AddressPreview>({});
  private readonly _locationSource = signal<LocationSource | null>(null);
  private readonly _gpsMeta = signal<GpsMeta>({});
  private readonly _placeId = signal<string | undefined>(undefined);
  private readonly _searchQuery = signal('');
  private readonly _searchResults = signal<AddressSearchResult[]>([]);
  private readonly _searching = signal(false);

  readonly mapReady = this._mapReady.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly markerPosition = this._markerPosition.asReadonly();
  readonly addressPreview = this._addressPreview.asReadonly();
  readonly locationSource = this._locationSource.asReadonly();
  readonly searchQuery = this._searchQuery.asReadonly();
  readonly searchResults = this._searchResults.asReadonly();
  readonly searching = this._searching.asReadonly();

  readonly providerName = computed(() => this.service.providerName);
  readonly isProviderConfigured = computed(() => this.service.isConfigured());

  /** The full pickable-location payload, ready to hand to a parent form/facade once a marker
   *  position and location source both exist. */
  readonly currentLocation = computed<PickedLocation | null>(() => {
    const marker = this._markerPosition();
    const source = this._locationSource();

    if (!marker || !source) {
      return null;
    }

    const preview = this._addressPreview();
    const gps = this._gpsMeta();

    return {
      ...marker,
      ...preview,
      ...gps,
      timestamp: gps.timestamp ?? new Date().toISOString(),
      provider: this.service.providerName,
      locationSource: source,
      placeId: this._placeId(),
    };
  });

  /** Keyed by 5-decimal-place lat,lng (~1.1m precision) so re-visiting the same spot during a
   *  drag never re-issues an identical reverse-geocode call. */
  private readonly reverseGeocodeCache = new Map<string, AddressPreview>();
  private readonly searchSubject = new Subject<string>();
  private eventsSubscription?: Subscription;
  private readonly searchSubscription: Subscription;

  constructor() {
    this.searchSubscription = this.searchSubject
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query.trim()) {
            return of<AddressSearchResult[]>([]);
          }

          this._searching.set(true);

          // switchMap cancels any still-in-flight search as soon as a newer query arrives.
          return from(this.service.searchAddresses(query)).pipe(catchError(() => of<AddressSearchResult[]>([])));
        }),
      )
      .subscribe((results) => {
        this._searchResults.set(results);
        this._searching.set(false);
      });
  }

  async initialize(container: HTMLElement, initialPosition?: MapLatLng): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    const center = initialPosition ?? DEFAULT_CENTER;
    this._markerPosition.set(initialPosition ?? null);

    try {
      if (!this.service.isConfigured()) {
        throw new Error(
          `${this.service.providerName} is not configured — add an API key to enable the interactive map.`,
        );
      }

      await this.service.loadMap({ container, center, zoom: initialPosition ? 16 : 5 });
      this.eventsSubscription = this.service.events$.subscribe((event) => this.handleEvent(event));
      this._mapReady.set(true);

      if (initialPosition) {
        await this.applyReverseGeocode(initialPosition, 'MANUAL');
      }
    } catch (error) {
      this._error.set(error instanceof Error ? error.message : 'Unable to load the map.');
    } finally {
      this._loading.set(false);
    }
  }

  private handleEvent(event: MapEvent): void {
    switch (event.type) {
      case 'map-click': {
        const position = event.payload as MapLatLng;
        this._markerPosition.set(position);
        this._locationSource.set('MAP_CLICK');
        this._gpsMeta.set({ timestamp: new Date().toISOString() });
        break;
      }

      case 'marker-drag-end': {
        const { position, preview } = event.payload as {
          position: MapLatLng;
          preview: AddressPreview & { placeId?: string };
        };
        this._markerPosition.set(position);
        this._addressPreview.set(preview);
        this._placeId.set(preview.placeId);
        this._locationSource.set('MARKER_DRAG');
        this._gpsMeta.set({ timestamp: new Date().toISOString() });
        this.cacheReverseGeocode(position, preview);
        break;
      }

      case 'reverse-geocode-completed': {
        const { position, preview } = event.payload as {
          position: MapLatLng;
          preview: AddressPreview & { placeId?: string };
        };
        this._addressPreview.set(preview);
        this._placeId.set(preview.placeId);
        this.cacheReverseGeocode(position, preview);
        break;
      }

      case 'current-location-retrieved': {
        const location = event.payload as PickedLocation;
        this._markerPosition.set({ lat: location.lat, lng: location.lng });
        this._addressPreview.set(location);
        this._placeId.set(location.placeId);
        this._locationSource.set('GPS');
        this._gpsMeta.set({
          accuracy: location.accuracy,
          altitude: location.altitude,
          heading: location.heading,
          speed: location.speed,
          timestamp: location.timestamp,
        });
        break;
      }

      case 'provider-error':
      case 'network-error':
        this._error.set('Something went wrong talking to the map provider. Please try again.');
        break;

      default:
        break;
    }
  }

  private cacheKey(position: MapLatLng): string {
    return `${position.lat?.toFixed(5)},${position.lng?.toFixed(5)}`;
  }

  private cacheReverseGeocode(position: MapLatLng, preview: AddressPreview): void {
    this.reverseGeocodeCache.set(this.cacheKey(position), preview);
  }

  private async applyReverseGeocode(position: MapLatLng, source: LocationSource): Promise<void> {
    const cached = this.reverseGeocodeCache.get(this.cacheKey(position));

    if (cached) {
      this._addressPreview.set(cached);
      this._locationSource.set(source);
      return;
    }

    try {
      const preview = await this.service.reverseGeocode(position);
      this._addressPreview.set(preview);
      this._locationSource.set(source);
      this.cacheReverseGeocode(position, preview);
    } catch {
      // Leave the existing preview as-is — this is a best-effort prefill, not a hard failure.
    }
  }

  search(query: string): void {
    this._searchQuery.set(query);
    this.searchSubject.next(query);
  }

  async selectSearchResult(result: AddressSearchResult): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const details = await this.service.getPlaceDetails(result.placeId);
      const position: MapLatLng = { lat: details.lat, lng: details.lng };

      this.service.moveMarker(position);
      this.service.setCenter(position, 17);

      this._markerPosition.set(position);
      this._addressPreview.set(details);
      this._placeId.set(details.placeId);
      this._locationSource.set('AUTOCOMPLETE');
      this._gpsMeta.set({ timestamp: new Date().toISOString() });
      this.cacheReverseGeocode(position, details);
      this._searchResults.set([]);
      this._searchQuery.set(details.formattedAddress ?? result.description);
    } catch {
      this._error.set('Unable to resolve that address. Please try another search or pick a point on the map.');
    } finally {
      this._loading.set(false);
    }
  }

  async useCurrentLocation(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const location = await this.service.getCurrentCoordinates();
      this.service.setCenter({ lat: location.lat, lng: location.lng }, 17);
      // The 'current-location-retrieved' event this call emits (handled above) already applies
      // the resulting state — nothing further to do here.
    } catch {
      this._error.set('Unable to get your current location. Check location permissions and try again.');
    } finally {
      this._loading.set(false);
    }
  }

  recenter(): void {
    const marker = this._markerPosition();
    if (marker) {
      this.service.setCenter(marker);
    }
  }

  clearSearch(): void {
    this._searchQuery.set('');
    this._searchResults.set([]);
  }

  destroy(): void {
    this.service.destroyMap();
    this.eventsSubscription?.unsubscribe();
    this.eventsSubscription = undefined;
    this._mapReady.set(false);
  }

  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
    this.destroy();
  }
}
