import { Injector, runInInjectionContext } from '@angular/core';
import { Subject } from 'rxjs';
import { MapPickerStore } from './map-picker.store';
import { MapPickerService } from '../services/map-picker.service';
import type { AddressPreview, MapEvent, MapLatLng, MapProviderName, PlaceDetails } from '../models/map-picker.models';

class FakeMapPickerService {
  configured = true;
  providerName: MapProviderName = 'GOOGLE_MAPS';

  readonly eventsSubject = new Subject<MapEvent>();
  readonly events$ = this.eventsSubject.asObservable();

  loadMap = jest.fn().mockResolvedValue(undefined);
  showMap = jest.fn();
  moveMarker = jest.fn();
  setCenter = jest.fn();
  fitBounds = jest.fn();
  getCurrentCoordinates = jest.fn();
  reverseGeocode = jest.fn();
  geocode = jest.fn();
  searchAddresses = jest.fn().mockResolvedValue([]);
  getPlaceDetails = jest.fn();
  calculateBounds = jest.fn();
  destroyMap = jest.fn();

  isConfigured(): boolean {
    return this.configured;
  }
}

function createStore(service: FakeMapPickerService): MapPickerStore {
  const injector = Injector.create({
    providers: [{ provide: MapPickerService, useValue: service }, MapPickerStore],
  });

  return runInInjectionContext(injector, () => injector.get(MapPickerStore));
}

describe('MapPickerStore', () => {
  let service: FakeMapPickerService;
  let store: MapPickerStore;
  let container: HTMLElement;

  beforeEach(() => {
    service = new FakeMapPickerService();
    store = createStore(service);
    container = document.createElement('div');
  });

  afterEach(() => {
    store.ngOnDestroy();
  });

  it('surfaces a clear error and skips loadMap when the provider is not configured', async () => {
    service.configured = false;

    await store.initialize(container);

    expect(service.loadMap).not.toHaveBeenCalled();
    expect(store.mapReady()).toBe(false);
    expect(store.error()).toContain('GOOGLE_MAPS is not configured');
  });

  it('loads the map at a default center and skips reverse-geocoding when no initial position is given', async () => {
    await store.initialize(container);

    expect(service.loadMap).toHaveBeenCalledWith(
      expect.objectContaining({ container, zoom: 5 }),
    );
    expect(store.mapReady()).toBe(true);
    expect(service.reverseGeocode).not.toHaveBeenCalled();
  });

  it('reverse-geocodes the initial position once and marks it MANUAL', async () => {
    const position: MapLatLng = { lat: 12.9716, lng: 77.5946 };
    const preview: AddressPreview = { formattedAddress: '221B Baker Street', city: 'Bengaluru' };
    service.reverseGeocode.mockResolvedValue(preview);

    await store.initialize(container, position);

    expect(service.loadMap).toHaveBeenCalledWith(expect.objectContaining({ container, center: position, zoom: 16 }));
    expect(service.reverseGeocode).toHaveBeenCalledTimes(1);
    expect(store.addressPreview()).toEqual(preview);
    expect(store.locationSource()).toBe('MANUAL');
    expect(store.currentLocation()).toMatchObject({ ...position, ...preview, locationSource: 'MANUAL' });
  });

  it('debounces search input and cancels the stale in-flight request', async () => {
    jest.useFakeTimers();

    try {
      await store.initialize(container);

      store.search('Bak');
      store.search('Baker');
      store.search('Baker St');

      jest.advanceTimersByTime(299);
      expect(service.searchAddresses).not.toHaveBeenCalled();

      jest.advanceTimersByTime(10);
      // Let the microtask queue (the resolved searchAddresses promise) flush.
      await Promise.resolve();
      await Promise.resolve();

      expect(service.searchAddresses).toHaveBeenCalledTimes(1);
      expect(service.searchAddresses).toHaveBeenCalledWith('Baker St');
    } finally {
      jest.useRealTimers();
    }
  });

  it('applies a map-click event by moving the marker and tagging the source as MAP_CLICK', async () => {
    await store.initialize(container);

    const position: MapLatLng = { lat: 1, lng: 2 };
    service.eventsSubject.next({ type: 'map-click', payload: position });

    expect(store.markerPosition()).toEqual(position);
    expect(store.locationSource()).toBe('MAP_CLICK');
  });

  it('applies a current-location-retrieved event with full GPS metadata', async () => {
    await store.initialize(container);

    service.eventsSubject.next({
      type: 'current-location-retrieved',
      payload: {
        lat: 10,
        lng: 20,
        accuracy: 5,
        timestamp: '2026-01-01T00:00:00.000Z',
        provider: 'GOOGLE_MAPS',
        locationSource: 'GPS',
        formattedAddress: 'Somewhere',
      },
    });

    expect(store.markerPosition()).toEqual({ lat: 10, lng: 20 });
    expect(store.locationSource()).toBe('GPS');
    expect(store.currentLocation()).toMatchObject({ accuracy: 5, provider: 'GOOGLE_MAPS' });
  });

  it('selectSearchResult moves the marker/map and marks the source as AUTOCOMPLETE', async () => {
    await store.initialize(container);

    const details: PlaceDetails = {
      lat: 5,
      lng: 6,
      placeId: 'place-1',
      formattedAddress: '10 Downing Street',
    };
    service.getPlaceDetails.mockResolvedValue(details);

    await store.selectSearchResult({ placeId: 'place-1', description: '10 Downing Street' });

    expect(service.moveMarker).toHaveBeenCalledWith({ lat: 5, lng: 6 });
    expect(service.setCenter).toHaveBeenCalledWith({ lat: 5, lng: 6 }, 17);
    expect(store.locationSource()).toBe('AUTOCOMPLETE');
    expect(store.searchResults()).toEqual([]);
  });

  it('destroy() tears down the underlying map and clears mapReady', async () => {
    await store.initialize(container);
    store.destroy();

    expect(service.destroyMap).toHaveBeenCalled();
    expect(store.mapReady()).toBe(false);
  });
});
