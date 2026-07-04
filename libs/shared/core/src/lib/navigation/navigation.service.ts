import { Injectable } from '@angular/core';

export interface NavigationDestination {
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Generates external navigation URLs (and related geo helpers) so components never build
 * these strings/formulas inline. No HTTP calls, no app state — pure presentation utilities.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  /** Builds a Google Maps directions URL, preferring coordinates over a free-text address. */
  buildMapsUrl(destination: NavigationDestination): string | null {
    if (destination.latitude != null && destination.longitude != null) {
      return `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;
    }

    if (destination.address) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination.address)}`;
    }

    return null;
  }

  /** Straight-line distance in kilometers between two coordinates (haversine formula). */
  distanceKm(origin: GeoPoint, destination: GeoPoint): number {
    const dLat = this.toRadians(destination.latitude - origin.latitude);
    const dLon = this.toRadians(destination.longitude - origin.longitude);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRadians(origin.latitude)) * Math.cos(this.toRadians(destination.latitude)) * Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
