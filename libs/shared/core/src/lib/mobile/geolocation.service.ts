import { Injectable } from '@angular/core';
import { Geolocation, type Position } from '@capacitor/geolocation';

export type GeolocationWatchError = 'unavailable';

/**
 * Thin wrapper over `@capacitor/geolocation` — the native primitive only (permission check/request,
 * start/stop watching position). Mirrors `PushNotificationsService`/`HapticsService`'s split: this
 * library provides the primitive, the feature that needs a live position (courier location
 * tracking, in delivery-app's case) owns when to start/stop watching and what to do with each fix.
 * Works on web too — the plugin's web implementation delegates to `navigator.geolocation` there, so
 * no `isNative()` branching is needed (unlike push notifications, a position fix is meaningful in a
 * plain browser tab).
 */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private watchId: string | null = null;

  /**
   * Ensures location permission is granted, requesting it if not yet decided. Returns false
   * without throwing if the user denies it — callers use this to decide whether to start watching,
   * not as an error condition.
   */
  async ensurePermission(): Promise<boolean> {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location === 'granted' || status.coarseLocation === 'granted') {
        return true;
      }
      if (status.location === 'denied') {
        return false;
      }
    } catch {
      // `checkPermissions` throws if system location services are off, or (on some browsers) if
      // the Permissions API isn't available at all — fall through and let requestPermissions decide.
    }

    try {
      const requested = await Geolocation.requestPermissions();
      return requested.location === 'granted' || requested.coarseLocation === 'granted';
    } catch {
      // `requestPermissions` isn't implemented on web — the browser shows its own permission
      // prompt on the first `watchPosition` call instead, so proceed and let that decide.
      return true;
    }
  }

  /**
   * Starts watching position, invoking `onPosition` for every fix and `onError` whenever the
   * platform can't provide one (GPS/location services off, signal lost). Safe to call more than
   * once — any prior watch is cleared first, so callers don't need to track handles themselves.
   */
  async startWatching(onPosition: (position: Position) => void, onError: (error: GeolocationWatchError) => void): Promise<void> {
    await this.stopWatching();

    this.watchId = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 15_000 }, (position, error) => {
      if (error || !position) {
        onError('unavailable');
        return;
      }
      onPosition(position);
    });
  }

  async stopWatching(): Promise<void> {
    if (this.watchId === null) {
      return;
    }

    const id = this.watchId;
    this.watchId = null;
    await Geolocation.clearWatch({ id });
  }
}
