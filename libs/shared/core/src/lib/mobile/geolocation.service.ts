import { Injectable } from '@angular/core';
import { Geolocation, type Position } from '@capacitor/geolocation';

/**
 * M5: distinguishes a permission problem (the user needs to grant access — retrying the watch
 * won't help) from a transient/hardware problem (GPS signal lost, location services off —
 * retrying later might succeed on its own). The plugin's `WatchPositionCallback` error parameter
 * is untyped (`err?: any`) and its shape isn't guaranteed consistent across web/Android/iOS, so
 * rather than guess at an error message/code, `classifyWatchError()` below re-checks the real
 * permission status via `checkPermissions()` — the same API `ensurePermission()` already trusts —
 * to answer this definitively instead of pattern-matching an undocumented error shape.
 */
export type GeolocationWatchError = 'unavailable' | 'permission-denied';

/**
 * M5.9 — `enableHighAccuracy: true` is a deliberate choice for this app's one use case (live
 * delivery-partner navigation tracking), not an oversight: the customer-facing live map and any
 * future turn-by-turn/ETA logic depend on street-level accuracy, and degrading it to save battery
 * would trade tracking *correctness* for power — explicitly the wrong trade per this phase's own
 * hardening goals. Battery impact is instead bounded at the call-site layer (courier-location.
 * service.ts's send-throttling/heartbeat), which reduces network and processing load without
 * touching GPS radio behavior at all — the GPS chip's own duty cycle is managed by the OS/hardware
 * layer beneath this API regardless of how often `watchPosition`'s JS callback fires.
 */
const WATCH_TIMEOUT_MS = 15_000;

/**
 * Thin wrapper over `@capacitor/geolocation` — the native primitive only (permission check/request,
 * start/stop watching position). Mirrors `PushNotificationsService`/`HapticsService`'s split: this
 * library provides the primitive, the feature that needs a live position (courier location
 * tracking, in delivery-app's case) owns when to start/stop watching and what to do with each fix.
 * Works on web too — the plugin's web implementation delegates to `navigator.geolocation` there, so
 * no `isNative()` branching is needed (unlike push notifications, a position fix is meaningful in a
 * plain browser tab).
 *
 * Does not support background execution — confirmed against the installed
 * `@capacitor/geolocation@8.2.1` package README, which states plainly: "This Capacitor plugin does
 * not support background geolocation directly." See `courier-location.service.ts`'s doc comment
 * for the full M5 evaluation of why no background-location plugin was added this phase.
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
      if (
        status.location === 'granted' ||
        status.coarseLocation === 'granted'
      ) {
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
      return (
        requested.location === 'granted' ||
        requested.coarseLocation === 'granted'
      );
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
  async startWatching(
    onPosition: (position: Position) => void,
    onError: (error: GeolocationWatchError) => void,
  ): Promise<void> {
    await this.stopWatching();

    this.watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: WATCH_TIMEOUT_MS },
      (position, error) => {
        if (error || !position) {
          void this.classifyWatchError().then(onError);
          return;
        }
        onPosition(position);
      },
    );
  }

  async stopWatching(): Promise<void> {
    if (this.watchId === null) {
      return;
    }

    const id = this.watchId;
    this.watchId = null;
    await Geolocation.clearWatch({ id });
  }

  /** See `GeolocationWatchError`'s doc comment for why this re-checks permissions rather than
   *  inspecting the watch callback's own (untyped, platform-inconsistent) error value. */
  private async classifyWatchError(): Promise<GeolocationWatchError> {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location === 'denied') {
        return 'permission-denied';
      }
    } catch {
      // `checkPermissions` itself throwing means system location services are off entirely —
      // that's a device-level/hardware condition, not a permission decision, so it falls through
      // to 'unavailable' below.
    }
    return 'unavailable';
  }
}
