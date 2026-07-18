import type { MapProviderName } from '@patheya-express-frontend/core';

export type { MapProviderName };

/** Mirrors the backend's `LocationSource` enum (see Address model) — kept as a plain string
 *  union on the frontend so providers/components never need a hard dependency on the SDK. */
export type LocationSource =
  | 'GPS'
  | 'MANUAL'
  | 'AUTOCOMPLETE'
  | 'REVERSE_GEOCODE'
  | 'MAP_CLICK'
  | 'MARKER_DRAG';

export interface MapLatLng {
  lat: number;
  lng: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface AddressPreview {
  formattedAddress?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/** The full result of a location pick, ready to be persisted onto an Address/Branch record. */
export interface PickedLocation extends MapLatLng, AddressPreview {
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  /** ISO-8601 timestamp of when the coordinates were captured. */
  timestamp: string;
  provider: MapProviderName;
  locationSource: LocationSource;
  placeId?: string;
}

export interface AddressSearchResult {
  placeId: string;
  description: string;
}

export interface PlaceDetails extends MapLatLng, AddressPreview {
  placeId: string;
}

export interface LoadMapOptions {
  container: HTMLElement;
  center: MapLatLng;
  zoom?: number;
  mapTypeControl?: boolean;
  fullscreenControl?: boolean;
  zoomControl?: boolean;
}

export type MapEventType =
  | 'map-loaded'
  | 'map-ready'
  | 'marker-drag-start'
  | 'marker-drag-end'
  | 'map-click'
  | 'zoom-changed'
  | 'center-changed'
  | 'current-location-retrieved'
  | 'address-selected'
  | 'reverse-geocode-completed'
  | 'provider-error'
  | 'network-error';

export interface MapEvent<T = unknown> {
  type: MapEventType;
  payload?: T;
}
