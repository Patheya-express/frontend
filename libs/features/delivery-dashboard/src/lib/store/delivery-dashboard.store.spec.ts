import { TestBed } from '@angular/core/testing';
import type { DeliveryPartnerResponseDto } from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import {
  GeolocationService,
  MobilePlatformService,
} from '@patheya-express-frontend/core';
import { DeliveryDashboardStore } from './delivery-dashboard.store';
import { DeliveryDashboardService } from '../services/delivery-dashboard.service';

const HEARTBEAT_MS = 60_000;

const FIX = { coords: { latitude: 12.9716, longitude: 77.5946 } } as const;

function buildPartner(
  overrides: Partial<DeliveryPartnerResponseDto> = {},
): DeliveryPartnerResponseDto {
  return {
    id: 'partner-1',
    userId: 'user-1',
    status: 'AVAILABLE',
    isVerified: true,
    vehicleNumber: 'KA-01-AB-1234',
    vehicleType: 'BIKE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('DeliveryDashboardStore — Presence Heartbeat Hardening', () => {
  let dashboardService: {
    getPartner: jest.Mock;
    getAssignedOrders: jest.Mock;
    getMyAssignments: jest.Mock;
    goOnline: jest.Mock;
    goOffline: jest.Mock;
    pingOnline: jest.Mock;
  };
  let geolocationService: {
    ensurePermission: jest.Mock;
    getCurrentPosition: jest.Mock;
  };
  let resumeCallback: (() => void) | undefined;
  let mobilePlatform: { isNative: jest.Mock; onResume: jest.Mock };
  let logoutRegistry: LogoutCleanupRegistry;

  beforeEach(() => {
    jest.useFakeTimers();
    resumeCallback = undefined;

    dashboardService = {
      getPartner: jest
        .fn()
        .mockResolvedValue(buildPartner({ status: 'OFFLINE' })),
      getAssignedOrders: jest.fn().mockResolvedValue([]),
      getMyAssignments: jest.fn().mockResolvedValue([]),
      goOnline: jest
        .fn()
        .mockResolvedValue(buildPartner({ status: 'AVAILABLE' })),
      goOffline: jest
        .fn()
        .mockResolvedValue(buildPartner({ status: 'OFFLINE' })),
      pingOnline: jest.fn().mockResolvedValue(undefined),
    };

    // Default: permission granted, a real fix available — matches the common case so the
    // pre-existing heartbeat-timing tests above don't need to know location exists at all.
    // Tests that care about location specifically override these per-case below.
    geolocationService = {
      ensurePermission: jest.fn().mockResolvedValue(true),
      getCurrentPosition: jest.fn().mockResolvedValue(FIX),
    };

    mobilePlatform = {
      isNative: jest.fn().mockReturnValue(true),
      onResume: jest.fn((callback: () => void) => {
        resumeCallback = callback;
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: DeliveryDashboardService, useValue: dashboardService },
        { provide: MobilePlatformService, useValue: mobilePlatform },
        { provide: GeolocationService, useValue: geolocationService },
      ],
    });

    logoutRegistry = TestBed.inject(LogoutCleanupRegistry);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    TestBed.resetTestingModule();
  });

  // Location adds a few extra microtask hops (ensurePermission -> getCurrentPosition -> the
  // underlying service call) ahead of every goOnline()/pingOnline() call now, so this flushes
  // more ticks than a single await pair would cover.
  async function flush(): Promise<void> {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  }

  it('Go Online starts the heartbeat — pings after one interval, none before', async () => {
    const store = TestBed.inject(DeliveryDashboardStore);

    await store.goOnline();
    expect(dashboardService.pingOnline).not.toHaveBeenCalled();

    jest.advanceTimersByTime(HEARTBEAT_MS);
    await flush();

    expect(dashboardService.pingOnline).toHaveBeenCalledTimes(1);
  });

  it('duplicate Go Online never creates a second timer', async () => {
    const store = TestBed.inject(DeliveryDashboardStore);

    await store.goOnline();
    await store.goOnline();
    await store.goOnline();

    jest.advanceTimersByTime(HEARTBEAT_MS);
    await flush();

    // If a second/third interval had been created, three (or more) pings would fire per tick.
    expect(dashboardService.pingOnline).toHaveBeenCalledTimes(1);
  });

  it('Go Offline stops the heartbeat and calls markOffline immediately', async () => {
    const store = TestBed.inject(DeliveryDashboardStore);

    await store.goOnline();
    await store.goOffline();

    expect(dashboardService.goOffline).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(HEARTBEAT_MS * 3);
    await flush();

    expect(dashboardService.pingOnline).not.toHaveBeenCalled();
  });

  it('logout stops the heartbeat', async () => {
    const store = TestBed.inject(DeliveryDashboardStore);

    await store.goOnline();
    logoutRegistry.runAll();

    jest.advanceTimersByTime(HEARTBEAT_MS * 3);
    await flush();

    expect(dashboardService.pingOnline).not.toHaveBeenCalled();
  });

  it('app resume immediately refreshes presence without waiting for the next interval', async () => {
    const store = TestBed.inject(DeliveryDashboardStore);
    void store;

    await store.goOnline();
    expect(mobilePlatform.onResume).toHaveBeenCalledTimes(1);

    // No time advanced at all — this only works if resume triggers an out-of-band ping.
    resumeCallback?.();
    await flush();

    expect(dashboardService.pingOnline).toHaveBeenCalledTimes(1);
  });

  it('network reconnect immediately refreshes presence', async () => {
    const store = TestBed.inject(DeliveryDashboardStore);

    await store.goOnline();

    window.dispatchEvent(new Event('online'));
    await flush();

    expect(dashboardService.pingOnline).toHaveBeenCalledTimes(1);
  });

  it('app resume / reconnect while offline does nothing (never starts a heartbeat on its own)', async () => {
    TestBed.inject(DeliveryDashboardStore);

    resumeCallback?.();
    window.dispatchEvent(new Event('online'));
    await flush();

    expect(dashboardService.pingOnline).not.toHaveBeenCalled();
  });

  it('a failed heartbeat is logged and retried naturally on the next interval, never flips the driver offline', async () => {
    const store = TestBed.inject(DeliveryDashboardStore);
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    dashboardService.pingOnline
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValue(undefined);

    await store.goOnline();

    jest.advanceTimersByTime(HEARTBEAT_MS);
    await flush();
    expect(dashboardService.pingOnline).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'presence_heartbeat_failed',
      expect.objectContaining({ feature: 'delivery-dashboard' }),
    );
    // Never flips isOnline() based on a failed ping — that signal is driven by partner.status only.
    expect(store.isOnline()).toBe(true);

    jest.advanceTimersByTime(HEARTBEAT_MS);
    await flush();
    expect(dashboardService.pingOnline).toHaveBeenCalledTimes(2);

    warnSpy.mockRestore();
  });

  it('no timer leak: once stopped, advancing time indefinitely never pings again', async () => {
    const store = TestBed.inject(DeliveryDashboardStore);

    await store.goOnline();
    await store.goOffline();

    for (let i = 0; i < 20; i += 1) {
      jest.advanceTimersByTime(HEARTBEAT_MS);
    }
    await flush();

    expect(dashboardService.pingOnline).not.toHaveBeenCalled();
  });

  it('stopping an already-stopped heartbeat is a safe no-op (destroy/cleanup safety)', async () => {
    const store = TestBed.inject(DeliveryDashboardStore);

    // Never went online — logout cleanup (or any other teardown path) must not throw when
    // there was never a heartbeat running in the first place.
    expect(() => logoutRegistry.runAll()).not.toThrow();

    await store.goOnline();
    await store.goOffline();

    // Stopping twice in a row (offline, then logout) must also be a safe no-op.
    expect(() => logoutRegistry.runAll()).not.toThrow();
  });

  it('loadDashboard() restarts the heartbeat if the partner is already AVAILABLE (survives app relaunch)', async () => {
    dashboardService.getPartner.mockResolvedValue(
      buildPartner({ status: 'AVAILABLE' }),
    );
    const store = TestBed.inject(DeliveryDashboardStore);

    await store.loadDashboard();

    jest.advanceTimersByTime(HEARTBEAT_MS);
    await flush();

    expect(dashboardService.pingOnline).toHaveBeenCalledTimes(1);
  });
});

describe('DeliveryDashboardStore — always-on presence location (2026-09-16 follow-up)', () => {
  let dashboardService: {
    getPartner: jest.Mock;
    getAssignedOrders: jest.Mock;
    getMyAssignments: jest.Mock;
    goOnline: jest.Mock;
    goOffline: jest.Mock;
    pingOnline: jest.Mock;
  };
  let geolocationService: {
    ensurePermission: jest.Mock;
    getCurrentPosition: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();

    dashboardService = {
      getPartner: jest
        .fn()
        .mockResolvedValue(buildPartner({ status: 'OFFLINE' })),
      getAssignedOrders: jest.fn().mockResolvedValue([]),
      getMyAssignments: jest.fn().mockResolvedValue([]),
      goOnline: jest
        .fn()
        .mockResolvedValue(buildPartner({ status: 'AVAILABLE' })),
      goOffline: jest
        .fn()
        .mockResolvedValue(buildPartner({ status: 'OFFLINE' })),
      pingOnline: jest.fn().mockResolvedValue(undefined),
    };

    geolocationService = {
      ensurePermission: jest.fn().mockResolvedValue(true),
      getCurrentPosition: jest.fn().mockResolvedValue(FIX),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: DeliveryDashboardService, useValue: dashboardService },
        {
          provide: MobilePlatformService,
          useValue: { isNative: jest.fn(), onResume: jest.fn() },
        },
        { provide: GeolocationService, useValue: geolocationService },
      ],
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    TestBed.resetTestingModule();
  });

  async function flush(): Promise<void> {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  }

  it('goOnline() fetches a fix and passes it through to dashboardService.goOnline', async () => {
    const store = TestBed.inject(DeliveryDashboardStore);

    await store.goOnline();

    expect(geolocationService.ensurePermission).toHaveBeenCalledTimes(1);
    expect(geolocationService.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(dashboardService.goOnline).toHaveBeenCalledWith({
      latitude: 12.9716,
      longitude: 77.5946,
    });
  });

  it('every heartbeat tick fetches a fresh fix and passes it through to pingOnline', async () => {
    const store = TestBed.inject(DeliveryDashboardStore);
    await store.goOnline();
    geolocationService.getCurrentPosition.mockClear();

    jest.advanceTimersByTime(HEARTBEAT_MS);
    await flush();

    expect(geolocationService.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(dashboardService.pingOnline).toHaveBeenCalledWith({
      latitude: 12.9716,
      longitude: 77.5946,
    });
  });

  it('going online still succeeds with no location when permission is denied — never blocks on it', async () => {
    geolocationService.ensurePermission.mockResolvedValue(false);
    const store = TestBed.inject(DeliveryDashboardStore);

    await store.goOnline();

    expect(geolocationService.getCurrentPosition).not.toHaveBeenCalled();
    expect(dashboardService.goOnline).toHaveBeenCalledWith(undefined);
    expect(store.isOnline()).toBe(true);
  });

  it('going online still succeeds with no location when getCurrentPosition resolves null', async () => {
    geolocationService.getCurrentPosition.mockResolvedValue(null);
    const store = TestBed.inject(DeliveryDashboardStore);

    await store.goOnline();

    expect(dashboardService.goOnline).toHaveBeenCalledWith(undefined);
    expect(store.isOnline()).toBe(true);
  });

  it('a heartbeat still succeeds with no location when the fix throws — never fails the tick', async () => {
    const store = TestBed.inject(DeliveryDashboardStore);
    await store.goOnline();
    geolocationService.getCurrentPosition.mockRejectedValue(
      new Error('GPS unavailable'),
    );

    jest.advanceTimersByTime(HEARTBEAT_MS);
    await flush();

    expect(dashboardService.pingOnline).toHaveBeenCalledWith(undefined);
  });
});
