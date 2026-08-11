import { Injectable, inject, signal } from '@angular/core';
import type { Position } from '@capacitor/geolocation';
import { TrackingService } from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { GeolocationService } from '@patheya-express-frontend/core';

export type CourierLocationStatus = 'idle' | 'tracking' | 'permission-denied' | 'unavailable';

/** Floor between sends, regardless of movement — the hard cap on update frequency. */
const MIN_SEND_INTERVAL_MS = 10_000;
/** Forces a send at least this often even while stationary, so the backend's Redis TTL (15 min)
 *  and the customer's "last updated"/ETA readout never go stale during a long stop (traffic, a
 *  red light, waiting at the restaurant). Comfortably under the TTL with room to spare. */
const HEARTBEAT_INTERVAL_MS = 45_000;
/** Below this, a position delta is GPS jitter, not real movement — skip the send. */
const MOVEMENT_THRESHOLD_METERS = 25;

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const earthRadiusMeters = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a));
}

/**
 * Sends this delivery partner's live GPS position for whichever order they're currently
 * out-for-delivery on (AUDIT-016). The backend (`TrackingService.trackingControllerUpdateLocation`)
 * already enforces that the caller is that order's assigned delivery partner — this service just
 * decides *when* to call it: throttled by time + a movement threshold, never more than once per
 * `MIN_SEND_INTERVAL_MS`, and at least once per `HEARTBEAT_INTERVAL_MS` even when stationary.
 * Owned by `DeliveryAssignmentsStore`, which starts/stops it as the active assignment's order
 * status changes — this service has no opinion on *which* order should be tracked.
 */
@Injectable({ providedIn: 'root' })
export class CourierLocationService {
  private readonly geolocation = inject(GeolocationService);
  private readonly trackingService = inject(TrackingService);

  private trackedOrderId: string | null = null;
  private lastSent: { lat: number; lng: number; at: number } | null = null;

  private readonly _status = signal<CourierLocationStatus>('idle');
  readonly status = this._status.asReadonly();

  constructor() {
    inject(LogoutCleanupRegistry).register(() => void this.stop());
  }

  /** No-op if already tracking this order. Switches targets if a different order is passed — a
   *  partner only ever has one out-for-delivery order at a time. */
  async start(orderId: string): Promise<void> {
    if (this.trackedOrderId === orderId) {
      return;
    }

    this.trackedOrderId = orderId;
    this.lastSent = null;

    const granted = await this.geolocation.ensurePermission();
    if (this.trackedOrderId !== orderId) {
      return; // stopped, or switched to a different order, while the permission prompt was up
    }
    if (!granted) {
      this._status.set('permission-denied');
      return;
    }

    this._status.set('tracking');
    try {
      await this.geolocation.startWatching(
        (position) => void this.handlePosition(orderId, position),
        () => this._status.set('unavailable'),
      );
    } catch {
      // e.g. system location services are off entirely — same user-facing outcome as a runtime
      // watch error, so it shares that status rather than needing its own.
      if (this.trackedOrderId === orderId) {
        this._status.set('unavailable');
      }
    }
  }

  async stop(): Promise<void> {
    this.trackedOrderId = null;
    this.lastSent = null;
    this._status.set('idle');
    await this.geolocation.stopWatching();
  }

  private async handlePosition(orderId: string, position: Position): Promise<void> {
    if (this.trackedOrderId !== orderId) {
      return; // stale callback from a watch already superseded by stop()/a different start()
    }

    const { latitude, longitude } = position.coords;
    const now = Date.now();

    if (this.lastSent) {
      const elapsed = now - this.lastSent.at;
      if (elapsed < MIN_SEND_INTERVAL_MS) {
        return;
      }

      const movedMeters = haversineMeters(this.lastSent.lat, this.lastSent.lng, latitude, longitude);
      if (movedMeters < MOVEMENT_THRESHOLD_METERS && elapsed < HEARTBEAT_INTERVAL_MS) {
        return;
      }
    }

    this.lastSent = { lat: latitude, lng: longitude, at: now };
    this._status.set('tracking');

    try {
      await this.trackingService.trackingControllerUpdateLocation({ body: { orderId, latitude, longitude } });
    } catch {
      // Best-effort — a dropped update is superseded by the next watch tick or heartbeat; nothing
      // meaningful to recover here, and surfacing a transient network blip would be noise for a
      // partner who's mid-delivery.
    }
  }
}
