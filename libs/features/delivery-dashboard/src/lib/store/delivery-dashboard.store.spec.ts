import { TestBed } from '@angular/core/testing';
import type { DeliveryPartnerResponseDto } from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { MobilePlatformService } from '@patheya-express-frontend/core';
import { DeliveryDashboardStore } from './delivery-dashboard.store';
import { DeliveryDashboardService } from '../services/delivery-dashboard.service';

const HEARTBEAT_MS = 60_000;

function buildPartner(overrides: Partial<DeliveryPartnerResponseDto> = {}): DeliveryPartnerResponseDto {
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
  let resumeCallback: (() => void) | undefined;
  let mobilePlatform: { isNative: jest.Mock; onResume: jest.Mock };
  let logoutRegistry: LogoutCleanupRegistry;

  beforeEach(() => {
    jest.useFakeTimers();
    resumeCallback = undefined;

    dashboardService = {
      getPartner: jest.fn().mockResolvedValue(buildPartner({ status: 'OFFLINE' })),
      getAssignedOrders: jest.fn().mockResolvedValue([]),
      getMyAssignments: jest.fn().mockResolvedValue([]),
      goOnline: jest.fn().mockResolvedValue(buildPartner({ status: 'AVAILABLE' })),
      goOffline: jest.fn().mockResolvedValue(buildPartner({ status: 'OFFLINE' })),
      pingOnline: jest.fn().mockResolvedValue(undefined),
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
      ],
    });

    logoutRegistry = TestBed.inject(LogoutCleanupRegistry);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    TestBed.resetTestingModule();
  });

  async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
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
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    dashboardService.pingOnline
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValue(undefined);

    await store.goOnline();

    jest.advanceTimersByTime(HEARTBEAT_MS);
    await flush();
    expect(dashboardService.pingOnline).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({ event: 'presence_heartbeat_failed' }));
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
    dashboardService.getPartner.mockResolvedValue(buildPartner({ status: 'AVAILABLE' }));
    const store = TestBed.inject(DeliveryDashboardStore);

    await store.loadDashboard();

    jest.advanceTimersByTime(HEARTBEAT_MS);
    await flush();

    expect(dashboardService.pingOnline).toHaveBeenCalledTimes(1);
  });
});
