import type { AppEnvironment, MapProviderName } from '@patheya-express-frontend/core';
import { selectAddressProvider } from './address-provider.factory';
import type { GoogleMapsAddressProvider } from './google-maps/google-maps-address-provider.service';
import type { MapboxAddressProvider } from './mapbox/mapbox-address-provider.service';
import type { HereMapsAddressProvider } from './here-maps/here-maps-address-provider.service';
import type { OpenStreetMapAddressProvider } from './openstreetmap/openstreetmap-address-provider.service';
import type { AzureMapsAddressProvider } from './azure-maps/azure-maps-address-provider.service';

const google = { marker: 'google' } as unknown as GoogleMapsAddressProvider;
const mapbox = { marker: 'mapbox' } as unknown as MapboxAddressProvider;
const hereMaps = { marker: 'here' } as unknown as HereMapsAddressProvider;
const openStreetMap = { marker: 'osm' } as unknown as OpenStreetMapAddressProvider;
const azureMaps = { marker: 'azure' } as unknown as AzureMapsAddressProvider;

function environmentWithProvider(provider: MapProviderName): AppEnvironment {
  return {
    production: false,
    apiBaseUrl: '',
    socketUrl: '',
    mediaBaseUrl: '',
    razorpayKeyId: '',
    maps: { provider },
  };
}

describe('selectAddressProvider', () => {
  it.each([
    ['GOOGLE_MAPS', google],
    ['MAPBOX', mapbox],
    ['HERE_MAPS', hereMaps],
    ['OPENSTREETMAP', openStreetMap],
    ['AZURE_MAPS', azureMaps],
  ] as const)('resolves %s to the matching provider instance', (providerName, expected) => {
    const selected = selectAddressProvider(
      environmentWithProvider(providerName),
      google,
      mapbox,
      hereMaps,
      openStreetMap,
      azureMaps,
    );

    expect(selected).toBe(expected);
  });

  it('defaults to Google Maps for an unrecognized provider name', () => {
    const selected = selectAddressProvider(
      environmentWithProvider('BING_MAPS' as MapProviderName),
      google,
      mapbox,
      hereMaps,
      openStreetMap,
      azureMaps,
    );

    expect(selected).toBe(google);
  });
});
