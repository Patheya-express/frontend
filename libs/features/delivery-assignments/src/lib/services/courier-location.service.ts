import { Injectable, effect, inject, signal } from '@angular/core';
import type { Position } from '@capacitor/geolocation';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import {
  GeolocationService,
  MobilePlatformService,
} from '@patheya-express-frontend/core';
import {
  classifyNetworkError,
  type NetworkErrorCategory,
} from '@patheya-express-frontend/mobile-networking';
import { NetworkStatusService } from '@patheya-express-frontend/ui';
import { TrackingService } from '@patheya-express-frontend/api-sdk';

/**
 * M5 tracking lifecycle. `'stopped'` was deliberately not added as an eighth state — with no
 * tracked order, "stopped" and "idle" are the same observable condition (no watch, nothing to
 * report), so folding them together avoids a state with no distinct behavior of its own.
 *  - idle               no active delivery to track
 *  - starting           permission check/request in flight for a newly-active delivery
 *  - tracking           watch is live and (assumed) delivering fixes
 *  - paused             foreground-only tracking is backgrounded — see "Background location" below
 *  - stopping           tearing down the watch (brief; included for a deterministic mid-teardown state)
 *  - permission-denied  the platform confirmed location permission is not granted
 *  - unavailable        a transient/hardware problem (GPS/location services off, no signal)
 */
export type CourierLocationStatus =
  | 'idle'
  | 'starting'
  | 'tracking'
  | 'paused'
  | 'stopping'
  | 'permission-denied'
  | 'unavailable';

/** Floor between sends, regardless of movement — the hard cap on update frequency. Unchanged from
 *  the pre-M5 value; re-inspected for M5 and found to already be well-reasoned (see below). */
const MIN_SEND_INTERVAL_MS = 10_000;
/** Forces a send at least this often even while stationary, so the backend's Redis TTL (15 min)
 *  and the customer's "last updated"/ETA readout never go stale during a long stop (traffic, a
 *  red light, waiting at the restaurant). Comfortably under the TTL with room to spare. Unchanged. */
const HEARTBEAT_INTERVAL_MS = 45_000;
/** Below this, a position delta is GPS jitter, not real movement — skip the send. Unchanged. */
const MOVEMENT_THRESHOLD_METERS = 25;
/**
 * M5.12 — a pending (not-yet-successfully-sent) location older than this is discarded rather than
 * eventually sent once connectivity returns: past this age, the position is stale enough that
 * presenting it as the courier's *current* location on the customer's live map would be actively
 * misleading, which is worse than the map briefly showing no update. Chosen as a small multiple of
 * `HEARTBEAT_INTERVAL_MS` — long enough to survive a brief tunnel/elevator/parking-garage dead
 * zone, short enough that anything older genuinely isn't "current" anymore.
 */
const MAX_PENDING_LOCATION_AGE_MS = 2 * 60 * 1000;

function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const earthRadiusMeters = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a));
}

interface PendingLocation {
  readonly orderId: string;
  readonly latitude: number;
  readonly longitude: number;
  /** The native GPS fix's own capture time (`Position.timestamp`), not when we decided to send it —
   *  see the class doc comment's "Location integrity" section. */
  readonly capturedAt: number;
}

/**
 * Sends this delivery partner's live GPS position for whichever order they're currently
 * out-for-delivery on (AUDIT-016). The backend (`TrackingService.trackingControllerUpdateLocation`)
 * already enforces that the caller is that order's assigned delivery partner — this service just
 * decides *when* to call it: throttled by time + a movement threshold, never more than once per
 * `MIN_SEND_INTERVAL_MS`, and at least once per `HEARTBEAT_INTERVAL_MS` even when stationary.
 * Owned by `DeliveryAssignmentsStore`, which starts/stops it as the active assignment's order
 * status changes — this service has no opinion on *which* order should be tracked.
 *
 * Background location (M5 evaluation): NOT implemented this phase. Before writing any code, two
 * Capacitor 8-compatible background-location plugins were researched:
 *  - `@capacitor-community/background-geolocation` (MIT, v1.2.26, 248★) has an OPEN, unresolved
 *    GitHub issue (#156, filed April 2026) reporting a `NullPointerException` crash on Android
 *    specifically when the app backgrounds under Capacitor 8 — the exact scenario this feature
 *    would need to handle. Not production-safe on this stack today.
 *  - `@capgo/background-geolocation` (MPL-2.0, tracks Capacitor's major version) targets Capacitor
 *    8 correctly and has no similarly-documented crash, but its own README states the same
 *    structural limitation as the plugin above: Android throttles WebView-issued HTTP requests
 *    (i.e. exactly the path `HttpClient`/the generated SDK/M2's interceptors use) after ~5 minutes
 *    backgrounded, requiring a *native* HTTP call to deliver updates reliably in the background —
 *    which would mean bypassing the generated SDK for backgrounded sends specifically, directly
 *    conflicting with this repository's "never bypass the generated SDK" rule and M2's networking
 *    architecture.
 * Given "prefer the smallest production-safe solution" and "do not add an unmaintained or
 * incompatible plugin," the evidence-based call is to defer true OS-level background execution
 * and hardened the foreground pipeline instead (state machine, throttling, integrity,
 * backpressure, lifecycle, privacy) — all of which apply equally whenever background tracking is
 * revisited. See the M5 report for the full evaluation.
 *
 * Location integrity (M5.10/M5.11): the backend's `UpdateLocationDto` has only `orderId`,
 * `latitude`, `longitude` — no timestamp/sequence field to add without a backend contract change,
 * which is out of scope for this phase. Ordering protection is therefore client-side only: each
 * accepted fix's native GPS timestamp (`Position.timestamp`) must be newer than the last *accepted*
 * fix's, rejecting an out-of-order/delayed native callback before it's ever considered for sending.
 * This does not, and cannot, protect against server-side reordering of two already-sent requests —
 * that would require the backend to accept an ordering field, which is a documented follow-up, not
 * something this phase pretends to solve.
 */
@Injectable({ providedIn: 'root' })
export class CourierLocationService {
  private readonly geolocation = inject(GeolocationService);
  private readonly trackingService = inject(TrackingService);
  private readonly networkStatus = inject(NetworkStatusService);
  private readonly mobilePlatform = inject(MobilePlatformService);

  private trackedOrderId: string | null = null;
  private lastSent: { lat: number; lng: number; at: number } | null = null;
  /** The native capture time of the last *accepted* fix — see the class doc comment's ordering
   *  protection. Reset whenever tracking (re)starts for a (possibly new) order. */
  private lastAcceptedFixTimestamp: number | null = null;

  /** M5.19 backpressure: the single newest not-yet-successfully-sent location, always overwritten
   *  by anything newer — never a queue. See the class doc comment. */
  private pending: PendingLocation | null = null;
  private sendInFlight = false;

  private readonly _status = signal<CourierLocationStatus>('idle');
  readonly status = this._status.asReadonly();

  /** M5.17 diagnostic only — the classified category of the most recent failed send, cleared on
   *  the next successful one. Nothing branches on this today (see `drainPending()`'s doc comment
   *  for why no retry policy varies by category); it exists so a failure's *kind* is inspectable
   *  (in tests, and for any future UI) without ever exposing the coordinates that failed to send. */
  private readonly _lastSendFailure = signal<NetworkErrorCategory | null>(null);
  readonly lastSendFailure = this._lastSendFailure.asReadonly();

  constructor() {
    inject(LogoutCleanupRegistry).register(() => void this.stop());

    // M5.4/M5.15 — foreground-only tracking (see class doc comment for why): honestly reflect that
    // fixes may stop arriving while backgrounded rather than silently claiming to still be
    // 'tracking', and reconcile on resume in case the OS killed the watch outright while
    // backgrounded. Independent registration on the same shared abstraction `RealtimeSocketService`
    // (M4) and `DeliveryAssignmentsStore`/`DeliveryDashboardStore` (M3) already use — not a second
    // lifecycle mechanism.
    this.mobilePlatform.onPause(() => this.handleBackground());
    this.mobilePlatform.onResume(() => this.handleForeground());

    // M5.12 — resume draining a buffered send the moment connectivity returns, in addition to the
    // opportunistic drain already attempted on every qualifying GPS callback.
    effect(() => {
      if (this.networkStatus.isOnline()) {
        void this.drainPending();
      }
    });
  }

  /** No-op if already tracking this order (including while a start for it is still in flight —
   *  see M5.16). Switches targets if a different order is passed — a partner only ever has one
   *  out-for-delivery order at a time. */
  async start(orderId: string): Promise<void> {
    if (this.trackedOrderId === orderId) {
      return;
    }

    this.trackedOrderId = orderId;
    this.lastSent = null;
    this.lastAcceptedFixTimestamp = null;
    this.pending = null;
    this._status.set('starting');

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
        (error) => {
          if (this.trackedOrderId === orderId) {
            this._status.set(error);
          }
        },
      );
    } catch {
      // e.g. system location services are off entirely — same user-facing outcome as a runtime
      // watch error, so it shares that status rather than needing its own.
      if (this.trackedOrderId === orderId) {
        this._status.set('unavailable');
      }
    }
  }

  /** Idempotent — safe to call while already stopped/stopping. */
  async stop(): Promise<void> {
    if (this.trackedOrderId === null && this._status() === 'idle') {
      return;
    }

    this.trackedOrderId = null;
    this.lastSent = null;
    this.lastAcceptedFixTimestamp = null;
    this.pending = null; // M5.12/M5.14: never carry a buffered fix past the delivery it belonged to
    this._status.set('stopping');
    await this.geolocation.stopWatching();
    this._status.set('idle');
  }

  /**
   * M5.15 — foreground-only tracking cannot guarantee fixes while backgrounded (see class doc
   * comment); this only updates the *reported* status so the UI never claims live tracking that
   * isn't happening. It deliberately does not tear down the watch — on iOS the underlying native
   * layer may still deliver a fix (in which case `handlePosition` simply resumes normal handling
   * and status corrects itself), and tearing down/recreating the watch on every background/
   * foreground cycle would be wasted work for no benefit given nothing here uses a foreground
   * service to keep it alive regardless.
   */
  private handleBackground(): void {
    if (this._status() === 'tracking') {
      this._status.set('paused');
    }
  }

  /** Defensively restarts the watch if the OS silently killed it while backgrounded, and retries
   *  any buffered send — belt-and-suspenders alongside the reconnect-triggered drain above. */
  private handleForeground(): void {
    const orderId = this.trackedOrderId;
    if (!orderId) {
      return;
    }

    if (this._status() === 'paused') {
      this._status.set('tracking');
    }

    void this.drainPending();
  }

  private handlePosition(orderId: string, position: Position): void {
    if (this.trackedOrderId !== orderId) {
      return; // stale callback from a watch already superseded by stop()/a different start()
    }

    // M5.10/M5.11 — reject an out-of-order/delayed native callback using the GPS fix's own
    // capture time, before it's ever considered for throttling or sending.
    if (
      this.lastAcceptedFixTimestamp !== null &&
      position.timestamp < this.lastAcceptedFixTimestamp
    ) {
      return;
    }
    this.lastAcceptedFixTimestamp = position.timestamp;

    const { latitude, longitude } = position.coords;
    const now = Date.now();

    if (this.lastSent) {
      const elapsed = now - this.lastSent.at;
      if (elapsed < MIN_SEND_INTERVAL_MS) {
        return;
      }

      const movedMeters = haversineMeters(
        this.lastSent.lat,
        this.lastSent.lng,
        latitude,
        longitude,
      );
      if (
        movedMeters < MOVEMENT_THRESHOLD_METERS &&
        elapsed < HEARTBEAT_INTERVAL_MS
      ) {
        return;
      }
    }

    this.lastSent = { lat: latitude, lng: longitude, at: now };
    if (this._status() !== 'paused') {
      this._status.set('tracking');
    }

    this.pending = {
      orderId,
      latitude,
      longitude,
      capturedAt: position.timestamp,
    };
    void this.drainPending();
  }

  /**
   * M5.18/M5.19 — the entire backpressure/retry mechanism: `pending` always holds only the newest
   * eligible-but-unsent fix (never a queue), sent one at a time. A fix superseded by a newer one
   * before it was ever sent is silently discarded — correct, since only the *current* position
   * matters for live tracking. A send already in flight is left alone; its own `finally` re-drains
   * once it settles, which is what picks up anything newer that arrived meanwhile.
   */
  private async drainPending(): Promise<void> {
    if (this.sendInFlight || !this.pending) {
      return;
    }

    if (Date.now() - this.pending.capturedAt > MAX_PENDING_LOCATION_AGE_MS) {
      this.pending = null; // too stale to present as current — see MAX_PENDING_LOCATION_AGE_MS
      return;
    }

    if (this.networkStatus.isOffline()) {
      return; // keep `pending` as-is; the online-transition effect or the next resume retries it
    }

    const { orderId, latitude, longitude } = this.pending;
    this.pending = null;
    this.sendInFlight = true;

    try {
      await this.trackingService.trackingControllerUpdateLocation({
        body: { orderId, latitude, longitude },
      });
      this._lastSendFailure.set(null);
    } catch (error) {
      // M5.17/M5.14 — classified (never a coordinate, never logged) and exposed via
      // `lastSendFailure` for diagnostics; a dropped update is superseded by the next watch tick
      // or heartbeat regardless of category, so no retry loop is started here for any of them,
      // including 'offline'/'timeout'.
      this._lastSendFailure.set(classifyNetworkError(error));
    } finally {
      this.sendInFlight = false;
      void this.drainPending();
    }
  }
}
