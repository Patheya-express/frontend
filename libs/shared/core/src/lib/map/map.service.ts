import { Injectable } from '@angular/core';

const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

export interface MapPoint {
  lat: number;
  lng: number;
}

export interface LiveTrackingMapHandle {
  updateDriverPosition(lat: number, lng: number): void;
  destroy(): void;
}

// Minimal structural typing for the pieces of the Leaflet API this service actually uses —
// avoids taking a compile-time dependency on @types/leaflet for a script loaded at runtime.
interface LeafletMarker {
  setLatLng(latLng: [number, number]): void;
  addTo(map: LeafletMap): LeafletMarker;
}

interface LeafletMap {
  setView(latLng: [number, number], zoom: number): LeafletMap;
  panTo(latLng: [number, number]): void;
  remove(): void;
}

interface LeafletNamespace {
  map(container: HTMLElement): LeafletMap;
  tileLayer(urlTemplate: string, options: Record<string, unknown>): { addTo(map: LeafletMap): void };
  marker(latLng: [number, number], options?: Record<string, unknown>): LeafletMarker;
  divIcon(options: Record<string, unknown>): unknown;
}

declare global {
  interface Window {
    L?: LeafletNamespace;
  }
}

/**
 * Lazily loads Leaflet (with OpenStreetMap tiles — no API key required) the same way
 * RazorpayCheckoutService lazily loads the Razorpay checkout script: inject the script/style
 * tags once, cache the load promise, and expose a small imperative handle to the caller.
 */
@Injectable({ providedIn: 'root' })
export class MapService {
  private scriptPromise: Promise<void> | null = null;

  private loadLeaflet(): Promise<void> {
    if (window.L) {
      return Promise.resolve();
    }

    if (!this.scriptPromise) {
      this.scriptPromise = new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS_URL;
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = LEAFLET_JS_URL;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load map library'));
        document.body.appendChild(script);
      });
    }

    return this.scriptPromise;
  }

  /** Renders a map centered on the delivery destination, with an optional live driver marker. */
  async createLiveTrackingMap(
    container: HTMLElement,
    destination: MapPoint,
    driver?: MapPoint,
  ): Promise<LiveTrackingMapHandle> {
    await this.loadLeaflet();

    const L = window.L;

    if (!L) {
      throw new Error('Map library failed to load');
    }

    const center = driver ?? destination;
    const map = L.map(container).setView([center.lat, center.lng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    L.marker([destination.lat, destination.lng], {
      icon: L.divIcon({ className: 'map-marker map-marker-destination', html: '📍' }),
    }).addTo(map);

    let driverMarker: LeafletMarker | null = driver
      ? L.marker([driver.lat, driver.lng], {
          icon: L.divIcon({ className: 'map-marker map-marker-driver', html: '🛵' }),
        }).addTo(map)
      : null;

    return {
      updateDriverPosition(lat: number, lng: number) {
        if (!driverMarker) {
          driverMarker = L.marker([lat, lng], {
            icon: L.divIcon({ className: 'map-marker map-marker-driver', html: '🛵' }),
          }).addTo(map);
        } else {
          driverMarker.setLatLng([lat, lng]);
        }

        map.panTo([lat, lng]);
      },

      destroy() {
        map.remove();
      },
    };
  }
}
