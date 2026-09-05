import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Position } from '@capacitor/geolocation';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import {
  GeolocationService,
  MobilePlatformService,
  type GeolocationWatchError,
} from '@patheya-express-frontend/core';
import { NetworkStatusService } from '@patheya-express-frontend/ui';
import { TrackingService } from '@patheya-express-frontend/api-sdk';
import { CourierLocationService } from './courier-location.service';

/** Fixed once per test run — every position's timestamp is expressed as an offset from this, so
 *  `drainPending()`'s real `Date.now()`-based staleness check sees realistic, currently-recent
 *  capture times rather than tiny epoch values (which would always look billions of ms stale). */
const NOW = Date.now();

function buildPosition(
  overrides: Partial<Position['coords']> = {},
  offsetMs = 0,
): Position {
  return {
    timestamp: NOW + offsetMs,
    coords: {
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 5,
      altitude: null,
      altitudeAccuracy: null,
      speed: null,
      heading: null,
      magneticHeading: null,
      trueHeading: null,
      headingAccuracy: null,
      course: null,
      ...overrides,
    },
  };
}

/** Roughly 30m north of the default `buildPosition()` coordinates — comfortably past the 25m
 *  movement threshold. */
function movedPosition(offsetMs = 0): Position {
  return buildPosition({ latitude: 12.97187 }, offsetMs);
}

/**
 * `handlePosition()`'s throttle window (`MIN_SEND_INTERVAL_MS`/`HEARTBEAT_INTERVAL_MS`) is
 * measured against the real wall clock (`Date.now()`), independently of whatever timestamp a
 * `Position` carries — that's a deliberate distinction (see the service's own doc comment on
 * "captured at T1" vs "sent at T2"). Testing the throttle itself therefore needs `Date.now()`
 * under actual control, not just a `Position.timestamp` offset — `jest.useFakeTimers()` +
 * `jest.setSystemTime()` for that, and this builds a position whose *own* timestamp matches
 * whatever fake "now" is currently set, so the ordering check and the throttle check agree.
 */
function buildPositionAtCurrentTime(
  overrides: Partial<Position['coords']> = {},
): Position {
  return buildPosition(overrides, Date.now() - NOW);
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Microtask-only flush, safe to use while `jest.useFakeTimers()` is active (unlike `flush()`,
 *  which needs a real macrotask to elapse). */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('CourierLocationService — M5 location hardening', () => {
  let geolocation: {
    ensurePermission: jest.Mock;
    startWatching: jest.Mock;
    stopWatching: jest.Mock;
  };
  let trackingService: { trackingControllerUpdateLocation: jest.Mock };
  let isOfflineSignal: ReturnType<typeof signal<boolean>>;
  let networkStatus: { isOffline: () => boolean; isOnline: () => boolean };
  let pauseCallback: (() => void) | undefined;
  let resumeCallback: (() => void) | undefined;
  let mobilePlatform: { onPause: jest.Mock; onResume: jest.Mock };
  let onPositionCb: ((position: Position) => void) | null;
  let onErrorCb: ((error: GeolocationWatchError) => void) | null;
  let logoutRegistry: LogoutCleanupRegistry;
  let consoleSpies: jest.SpyInstance[];

  beforeEach(() => {
    onPositionCb = null;
    onErrorCb = null;
    pauseCallback = undefined;
    resumeCallback = undefined;

    geolocation = {
      ensurePermission: jest.fn().mockResolvedValue(true),
      startWatching: jest.fn(
        (
          onPosition: (p: Position) => void,
          onError: (e: GeolocationWatchError) => void,
        ) => {
          onPositionCb = onPosition;
          onErrorCb = onError;
          return Promise.resolve();
        },
      ),
      stopWatching: jest.fn().mockResolvedValue(undefined),
    };

    trackingService = {
      trackingControllerUpdateLocation: jest.fn().mockResolvedValue({}),
    };

    isOfflineSignal = signal(false);
    networkStatus = {
      isOffline: () => isOfflineSignal(),
      isOnline: () => !isOfflineSignal(),
    };

    mobilePlatform = {
      onPause: jest.fn((cb: () => void) => {
        pauseCallback = cb;
      }),
      onResume: jest.fn((cb: () => void) => {
        resumeCallback = cb;
      }),
    };

    consoleSpies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
      jest.spyOn(console, 'info').mockImplementation(() => undefined),
      jest.spyOn(console, 'debug').mockImplementation(() => undefined),
    ];

    TestBed.configureTestingModule({
      providers: [
        { provide: GeolocationService, useValue: geolocation },
        { provide: TrackingService, useValue: trackingService },
        { provide: NetworkStatusService, useValue: networkStatus },
        { provide: MobilePlatformService, useValue: mobilePlatform },
      ],
    });

    logoutRegistry = TestBed.inject(LogoutCleanupRegistry);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    for (const spy of consoleSpies) {
      spy.mockRestore();
    }
    jest.useRealTimers();
  });

  describe('permission', () => {
    it('starts tracking once permission is granted', async () => {
      const service = TestBed.inject(CourierLocationService);

      await service.start('order-1');

      expect(geolocation.startWatching).toHaveBeenCalledTimes(1);
      expect(service.status()).toBe('tracking');
    });

    it('does not start tracking when permission is denied', async () => {
      geolocation.ensurePermission.mockResolvedValue(false);
      const service = TestBed.inject(CourierLocationService);

      await service.start('order-1');

      expect(geolocation.startWatching).not.toHaveBeenCalled();
      expect(service.status()).toBe('permission-denied');
    });

    it('handles permission being revoked while actively tracking', async () => {
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');
      expect(service.status()).toBe('tracking');

      onErrorCb?.('permission-denied');

      expect(service.status()).toBe('permission-denied');
    });

    it('does not re-request permission for a repeat start() call on the same order after denial', async () => {
      geolocation.ensurePermission.mockResolvedValue(false);
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');
      geolocation.ensurePermission.mockClear();

      await service.start('order-1');

      expect(geolocation.ensurePermission).not.toHaveBeenCalled();
    });
  });

  describe('tracker lifecycle (M5.16)', () => {
    it('creates exactly one native watcher when starting', async () => {
      const service = TestBed.inject(CourierLocationService);

      await service.start('order-1');

      expect(geolocation.startWatching).toHaveBeenCalledTimes(1);
    });

    it('calling start twice for the same order does not create a second watcher', async () => {
      const service = TestBed.inject(CourierLocationService);

      await service.start('order-1');
      await service.start('order-1');

      expect(geolocation.startWatching).toHaveBeenCalledTimes(1);
    });

    it('two concurrent start() calls for the same order (racing a slow permission prompt) only create one watcher', async () => {
      let resolvePermission: (granted: boolean) => void = () => undefined;
      geolocation.ensurePermission.mockReturnValue(
        new Promise((resolve) => {
          resolvePermission = resolve;
        }),
      );
      const service = TestBed.inject(CourierLocationService);

      const first = service.start('order-1');
      const second = service.start('order-1');
      resolvePermission(true);
      await first;
      await second;

      expect(geolocation.startWatching).toHaveBeenCalledTimes(1);
    });

    it('stop() is idempotent', async () => {
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      await service.stop();
      await expect(service.stop()).resolves.toBeUndefined();

      expect(service.status()).toBe('idle');
    });

    it('calling stop twice does not throw and does not call stopWatching a second time unnecessarily on an already-idle tracker', async () => {
      const service = TestBed.inject(CourierLocationService);

      await service.stop();
      geolocation.stopWatching.mockClear();
      await expect(service.stop()).resolves.toBeUndefined();

      expect(geolocation.stopWatching).not.toHaveBeenCalled();
    });

    it('logout stops tracking', async () => {
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      logoutRegistry.runAll();
      await flush();

      expect(service.status()).toBe('idle');
      expect(geolocation.stopWatching).toHaveBeenCalled();
    });

    it('resume reconciles a paused tracker back to tracking', async () => {
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');
      pauseCallback?.();
      expect(service.status()).toBe('paused');

      resumeCallback?.();

      expect(service.status()).toBe('tracking');
    });

    it('resume does nothing when there is no active tracked order', () => {
      TestBed.inject(CourierLocationService);

      expect(() => resumeCallback?.()).not.toThrow();
      expect(geolocation.startWatching).not.toHaveBeenCalled();
    });

    it('switching to a different order while tracking stops the old watch context (single authoritative watcher)', async () => {
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      await service.start('order-2');

      // startWatching is called again for the new order — GeolocationService itself guarantees
      // only one underlying native watch exists (it clears any prior one before starting).
      expect(geolocation.startWatching).toHaveBeenCalledTimes(2);
    });
  });

  describe('sampling (M5.8)', () => {
    it('does not send a fix that has not moved enough within the heartbeat window', async () => {
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPosition({}, 1_000));
      await flush();
      expect(
        trackingService.trackingControllerUpdateLocation,
      ).toHaveBeenCalledTimes(1);

      onPositionCb?.(buildPosition({}, 12_000)); // 11s later, no movement, still under 45s heartbeat
      await flush();

      expect(
        trackingService.trackingControllerUpdateLocation,
      ).toHaveBeenCalledTimes(1);
    });

    it('respects the minimum send interval even if the device has moved', async () => {
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPosition({}, 1_000));
      await flush();
      onPositionCb?.(movedPosition(5_000)); // only 4s later — under the 10s floor
      await flush();

      expect(
        trackingService.trackingControllerUpdateLocation,
      ).toHaveBeenCalledTimes(1);
    });

    it('sends once movement exceeds the distance threshold after the minimum interval', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(NOW);
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPositionAtCurrentTime());
      await flushMicrotasks();
      jest.setSystemTime(NOW + 14_000); // past both the 10s floor and the distance threshold
      onPositionCb?.(buildPositionAtCurrentTime({ latitude: 12.97187 }));
      await flushMicrotasks();

      expect(
        trackingService.trackingControllerUpdateLocation,
      ).toHaveBeenCalledTimes(2);
    });

    it('the heartbeat forces a send even while stationary once the heartbeat interval elapses', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(NOW);
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPositionAtCurrentTime());
      await flushMicrotasks();
      jest.setSystemTime(NOW + 46_000); // stationary, but past the 45s heartbeat
      onPositionCb?.(buildPositionAtCurrentTime());
      await flushMicrotasks();

      expect(
        trackingService.trackingControllerUpdateLocation,
      ).toHaveBeenCalledTimes(2);
    });

    it('does not send every raw GPS callback (many callbacks in a short window collapse to one send)', async () => {
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      for (let i = 0; i < 20; i += 1) {
        onPositionCb?.(buildPosition({}, 1_000 + i * 100)); // 20 callbacks across ~2s, stationary
      }
      await flush();

      expect(
        trackingService.trackingControllerUpdateLocation,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('location integrity (M5.10/M5.11)', () => {
    it('rejects an out-of-order native callback whose own GPS timestamp is older than the last accepted fix', async () => {
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPosition({}, 50_000));
      await flush();
      onPositionCb?.(movedPosition(20_000)); // an older, delayed callback arriving after a newer one
      await flush();

      expect(
        trackingService.trackingControllerUpdateLocation,
      ).toHaveBeenCalledTimes(1);
    });

    it('an out-of-order rejection does not corrupt ordering state for the next legitimately-newer fix', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(NOW);
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPositionAtCurrentTime()); // accepted
      await flushMicrotasks();
      onPositionCb?.(buildPosition({}, -30_000)); // older, delayed callback — rejected, must not corrupt state
      await flushMicrotasks();

      jest.setSystemTime(NOW + 46_000);
      onPositionCb?.(buildPositionAtCurrentTime({ latitude: 12.97187 })); // genuinely newer — still accepted
      await flushMicrotasks();

      expect(
        trackingService.trackingControllerUpdateLocation,
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe('network / error classification (M5.17)', () => {
    it('a successful submission clears any prior failure classification', async () => {
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      expect(service.lastSendFailure()).toBeNull();
    });

    it('classifies an HTTP 500 as server-error', async () => {
      const { HttpErrorResponse } = await import('@angular/common/http');
      trackingService.trackingControllerUpdateLocation.mockRejectedValue(
        new HttpErrorResponse({ status: 500 }),
      );
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPosition({}, 1_000));
      await flush();

      expect(service.lastSendFailure()).toBe('server-error');
    });

    it('classifies an HTTP 400 as client-error', async () => {
      const { HttpErrorResponse } = await import('@angular/common/http');
      trackingService.trackingControllerUpdateLocation.mockRejectedValue(
        new HttpErrorResponse({ status: 400 }),
      );
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPosition({}, 1_000));
      await flush();

      expect(service.lastSendFailure()).toBe('client-error');
    });

    it('classifies status 0 as offline', async () => {
      const { HttpErrorResponse } = await import('@angular/common/http');
      trackingService.trackingControllerUpdateLocation.mockRejectedValue(
        new HttpErrorResponse({ status: 0 }),
      );
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPosition({}, 1_000));
      await flush();

      expect(service.lastSendFailure()).toBe('offline');
    });

    it('does not retry a failed send — one attempt per eligible fix', async () => {
      trackingService.trackingControllerUpdateLocation.mockRejectedValue(
        new Error('network blip'),
      );
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPosition({}, 1_000));
      await flush();

      expect(
        trackingService.trackingControllerUpdateLocation,
      ).toHaveBeenCalledTimes(1);
    });

    it('does not attempt an HTTP call at all when already known to be offline', async () => {
      isOfflineSignal.set(true);
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPosition({}, 1_000));
      await flush();

      expect(
        trackingService.trackingControllerUpdateLocation,
      ).not.toHaveBeenCalled();
    });

    it('sends the buffered fix once connectivity returns', async () => {
      isOfflineSignal.set(true);
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');
      onPositionCb?.(buildPosition({}, 1_000));
      await flush();
      expect(
        trackingService.trackingControllerUpdateLocation,
      ).not.toHaveBeenCalled();

      isOfflineSignal.set(false);
      await flush();

      expect(
        trackingService.trackingControllerUpdateLocation,
      ).toHaveBeenCalledTimes(1);
    });

    it('concurrent GPS callbacks while a send is in flight do not create unbounded/parallel requests', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(NOW);
      let resolveSend: (value: unknown) => void = () => undefined;
      trackingService.trackingControllerUpdateLocation.mockReturnValue(
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
      );
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPositionAtCurrentTime());
      await flushMicrotasks();
      expect(
        trackingService.trackingControllerUpdateLocation,
      ).toHaveBeenCalledTimes(1);

      // A second eligible fix (past the interval floor and the distance threshold) arrives while
      // the first send is still in flight.
      jest.setSystemTime(NOW + 15_000);
      onPositionCb?.(buildPositionAtCurrentTime({ latitude: 12.97187 }));
      await flushMicrotasks();
      expect(
        trackingService.trackingControllerUpdateLocation,
      ).toHaveBeenCalledTimes(1); // still just one in-flight call

      resolveSend({});
      await flushMicrotasks();

      expect(
        trackingService.trackingControllerUpdateLocation,
      ).toHaveBeenCalledTimes(2); // the newer one was drained after
    });
  });

  describe('backpressure (M5.19) and buffer (M5.12/M5.13)', () => {
    it('keeps only the newest sample when many fixes arrive faster than sends complete (bounded memory)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(NOW);
      let resolveSend: (value: unknown) => void = () => undefined;
      trackingService.trackingControllerUpdateLocation.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSend = resolve;
          }),
      );
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');
      onPositionCb?.(buildPositionAtCurrentTime());
      await flushMicrotasks();

      // Many superseding fixes arrive while the first send is still in flight — only the latest
      // should ever be retained (a single slot, not a growing queue).
      for (let i = 1; i <= 10; i += 1) {
        jest.setSystemTime(NOW + 15_000 + i * 20_000);
        onPositionCb?.(buildPositionAtCurrentTime({ latitude: 12.97187 }));
      }
      await flushMicrotasks();
      resolveSend({});
      await flushMicrotasks();

      // One initial send + exactly one drained follow-up (the latest superseding sample) — never
      // one per superseded intermediate callback.
      expect(
        trackingService.trackingControllerUpdateLocation,
      ).toHaveBeenCalledTimes(2);
    });

    it('discards a buffered fix older than the maximum pending age instead of sending it stale', async () => {
      isOfflineSignal.set(true);
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');
      const staleOffsetMs = -3 * 60 * 1000; // older than the 2-minute cap
      onPositionCb?.(buildPosition({}, staleOffsetMs));
      await flush();

      isOfflineSignal.set(false);
      await flush();

      expect(
        trackingService.trackingControllerUpdateLocation,
      ).not.toHaveBeenCalled();
    });

    it('clears the buffered fix when tracking stops (delivery ends)', async () => {
      isOfflineSignal.set(true);
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');
      onPositionCb?.(buildPosition());
      await flush();

      await service.stop();
      isOfflineSignal.set(false);
      await flush();

      expect(
        trackingService.trackingControllerUpdateLocation,
      ).not.toHaveBeenCalled();
    });

    it('clears the buffered fix on logout', async () => {
      isOfflineSignal.set(true);
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');
      onPositionCb?.(buildPosition());
      await flush();

      logoutRegistry.runAll();
      await flush();
      isOfflineSignal.set(false);
      await flush();

      expect(
        trackingService.trackingControllerUpdateLocation,
      ).not.toHaveBeenCalled();
    });

    it('never includes anything beyond orderId/latitude/longitude in the submitted payload (no auth/payment data)', async () => {
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPosition({}, 1_000));
      await flush();

      const [[call]] =
        trackingService.trackingControllerUpdateLocation.mock.calls;
      expect(Object.keys(call.body).sort()).toEqual([
        'latitude',
        'longitude',
        'orderId',
      ]);
    });
  });

  describe('privacy (M5.14)', () => {
    it('never logs coordinates to the console under normal tracking', async () => {
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPosition({}, 1_000));
      await flush();
      onPositionCb?.(movedPosition(15_000));
      await flush();

      for (const spy of consoleSpies) {
        for (const call of spy.mock.calls) {
          expect(JSON.stringify(call)).not.toMatch(
            /12\.9716|77\.5946|12\.97187/,
          );
        }
      }
    });

    it('never logs coordinates even when a send fails', async () => {
      trackingService.trackingControllerUpdateLocation.mockRejectedValue(
        new Error('boom'),
      );
      const service = TestBed.inject(CourierLocationService);
      await service.start('order-1');

      onPositionCb?.(buildPosition({}, 1_000));
      await flush();

      for (const spy of consoleSpies) {
        expect(spy).not.toHaveBeenCalled();
      }
    });

    it('does not track before a delivery is active (no order id) — starting requires an explicit order', () => {
      TestBed.inject(CourierLocationService);

      expect(geolocation.startWatching).not.toHaveBeenCalled();
      expect(geolocation.ensurePermission).not.toHaveBeenCalled();
    });
  });
});
