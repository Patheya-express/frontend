import { Injector, runInInjectionContext } from '@angular/core';
import { APP_ENVIRONMENT, type AppEnvironment } from '@patheya-express-frontend/core';
import { AddressProviderNotImplementedError } from './address-provider';
import { MapboxAddressProvider } from './mapbox/mapbox-address-provider.service';

const BASE_ENVIRONMENT: AppEnvironment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  socketUrl: 'http://localhost:3000',
  mediaBaseUrl: 'http://localhost:3000',
  razorpayKeyId: '',
  maps: { provider: 'MAPBOX' },
};

/**
 * Constructs the provider via a bare `Injector` (not `TestBed`) — this class only injects
 * `APP_ENVIRONMENT`, so there's no need for Angular's NgModule/component compiler at all.
 */
function createProvider(environment: AppEnvironment): MapboxAddressProvider {
  const injector = Injector.create({
    providers: [{ provide: APP_ENVIRONMENT, useValue: environment }, MapboxAddressProvider],
  });

  return runInInjectionContext(injector, () => injector.get(MapboxAddressProvider));
}

describe('PlaceholderAddressProviderBase (via MapboxAddressProvider)', () => {
  it('reports unconfigured when no access token is set', () => {
    const provider = createProvider(BASE_ENVIRONMENT);
    expect(provider.isConfigured()).toBe(false);
  });

  it('reports configured once an access token is present', () => {
    const provider = createProvider({
      ...BASE_ENVIRONMENT,
      maps: { ...BASE_ENVIRONMENT.maps, mapboxAccessToken: 'pk.test' },
    });
    expect(provider.isConfigured()).toBe(true);
  });

  it('throws AddressProviderNotImplementedError from loadMap()', async () => {
    const provider = createProvider(BASE_ENVIRONMENT);
    const container = document.createElement('div');

    await expect(provider.loadMap({ container, center: { lat: 0, lng: 0 } })).rejects.toThrow(
      AddressProviderNotImplementedError,
    );
  });

  it.each(['reverseGeocode', 'geocode', 'searchAddresses', 'getPlaceDetails'] as const)(
    'throws AddressProviderNotImplementedError from %s()',
    async (method) => {
      const provider = createProvider(BASE_ENVIRONMENT);

      await expect(
        method === 'reverseGeocode'
          ? provider.reverseGeocode({ lat: 0, lng: 0 })
          : method === 'geocode'
            ? provider.geocode('221B Baker Street')
            : method === 'searchAddresses'
              ? provider.searchAddresses('Baker Street')
              : provider.getPlaceDetails('abc'),
      ).rejects.toThrow(AddressProviderNotImplementedError);
    },
  );

  it('throws synchronously from moveMarker/setCenter/fitBounds/calculateBounds', () => {
    const provider = createProvider(BASE_ENVIRONMENT);

    expect(() => provider.moveMarker({ lat: 0, lng: 0 })).toThrow(AddressProviderNotImplementedError);
    expect(() => provider.setCenter({ lat: 0, lng: 0 })).toThrow(AddressProviderNotImplementedError);
    expect(() => provider.fitBounds({ north: 1, south: 0, east: 1, west: 0 })).toThrow(
      AddressProviderNotImplementedError,
    );
    expect(() => provider.calculateBounds([{ lat: 0, lng: 0 }])).toThrow(AddressProviderNotImplementedError);
  });

  it('destroyMap() is a safe no-op', () => {
    const provider = createProvider(BASE_ENVIRONMENT);
    expect(() => provider.destroyMap()).not.toThrow();
  });

  it('getCurrentCoordinates() still returns real GPS coordinates tagged with this provider', async () => {
    const mockPosition: GeolocationPosition = {
      coords: {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    };

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => success(mockPosition),
        watchPosition: jest.fn(),
        clearWatch: jest.fn(),
      },
    });

    const provider = createProvider(BASE_ENVIRONMENT);
    const location = await provider.getCurrentCoordinates();

    expect(location.lat).toBe(12.9716);
    expect(location.lng).toBe(77.5946);
    expect(location.provider).toBe('MAPBOX');
    expect(location.locationSource).toBe('GPS');
  });
});
