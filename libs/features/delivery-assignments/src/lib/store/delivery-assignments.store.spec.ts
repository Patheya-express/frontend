import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { DeliveryAssignmentResponseDto } from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { MobilePlatformService } from '@patheya-express-frontend/core';
import { NetworkStatusService } from '@patheya-express-frontend/ui';
import type { CacheReadResult } from '@patheya-express-frontend/mobile-offline';
import { DeliveryAssignmentsStore } from './delivery-assignments.store';
import { ActiveAssignmentCacheService } from '../services/active-assignment-cache.service';
import { CourierLocationService } from '../services/courier-location.service';
import { DeliveryAssignmentsService } from '../services/delivery-assignments.service';

function buildAssignment(
  overrides: Partial<DeliveryAssignmentResponseDto> = {},
): DeliveryAssignmentResponseDto {
  return {
    id: 'assignment-1',
    orderId: 'order-1',
    deliveryPartnerId: 'partner-1',
    status: 'ACCEPTED',
    assignedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    order: {
      id: 'order-1',
      orderNumber: 'ORD-1',
      deliveryAddress: '221B Baker Street',
      deliveryFee: 40,
      totalAmount: 500,
      items: [],
      status: 'OUT_FOR_DELIVERY',
    },
    ...overrides,
  };
}

describe('DeliveryAssignmentsStore — M3 offline resilience', () => {
  let assignmentsService: {
    getAssignments: jest.Mock;
    acceptAssignment: jest.Mock;
    rejectAssignment: jest.Mock;
    generatePickupOtp: jest.Mock;
    verifyPickupOtp: jest.Mock;
    generateDeliveryOtp: jest.Mock;
    verifyDeliveryOtp: jest.Mock;
  };
  let cache: { read: jest.Mock; write: jest.Mock; clear: jest.Mock };
  let networkStatus: { isOffline: jest.Mock; isOnline: jest.Mock };
  let resumeCallback: (() => void) | undefined;
  let mobilePlatform: { isNative: jest.Mock; onResume: jest.Mock };
  let logoutRegistry: LogoutCleanupRegistry;

  function cachedResult(
    data: DeliveryAssignmentResponseDto,
    isStale = false,
  ): CacheReadResult<DeliveryAssignmentResponseDto> {
    return { data, cachedAt: Date.now(), isStale };
  }

  async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    resumeCallback = undefined;

    assignmentsService = {
      getAssignments: jest.fn().mockResolvedValue([]),
      acceptAssignment: jest.fn().mockResolvedValue(undefined),
      rejectAssignment: jest.fn().mockResolvedValue(undefined),
      generatePickupOtp: jest.fn(),
      verifyPickupOtp: jest.fn(),
      generateDeliveryOtp: jest.fn(),
      verifyDeliveryOtp: jest.fn(),
    };

    cache = {
      read: jest.fn().mockResolvedValue(null),
      write: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };

    networkStatus = {
      isOffline: jest.fn().mockReturnValue(false),
      isOnline: jest.fn().mockReturnValue(true),
    };

    mobilePlatform = {
      isNative: jest.fn().mockReturnValue(true),
      onResume: jest.fn((callback: () => void) => {
        resumeCallback = callback;
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: DeliveryAssignmentsService, useValue: assignmentsService },
        { provide: ActiveAssignmentCacheService, useValue: cache },
        { provide: NetworkStatusService, useValue: networkStatus },
        { provide: MobilePlatformService, useValue: mobilePlatform },
        {
          provide: CourierLocationService,
          useValue: {
            status: signal('idle'),
            start: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });

    logoutRegistry = TestBed.inject(LogoutCleanupRegistry);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('cache writes on successful fetch', () => {
    it('writes the active assignment to cache after a successful fetch', async () => {
      const active = buildAssignment();
      assignmentsService.getAssignments.mockResolvedValue([active]);
      const store = TestBed.inject(DeliveryAssignmentsStore);

      await store.loadAssignments();

      expect(cache.write).toHaveBeenCalledWith(active);
      expect(store.activeAssignmentStatus()).toBe('fresh');
    });

    it('clears the cache when the backend confirms there is no active assignment', async () => {
      assignmentsService.getAssignments.mockResolvedValue([]);
      const store = TestBed.inject(DeliveryAssignmentsStore);

      await store.loadAssignments();

      expect(cache.clear).toHaveBeenCalled();
      expect(cache.write).not.toHaveBeenCalled();
      expect(store.activeAssignmentStatus()).toBe('empty');
    });
  });

  describe('offline cold start', () => {
    it('loads the last known active assignment from cache when the initial fetch fails', async () => {
      assignmentsService.getAssignments.mockRejectedValue(new Error('offline'));
      const cachedAssignment = buildAssignment({ id: 'cached-assignment' });
      cache.read.mockResolvedValue(cachedResult(cachedAssignment));
      const store = TestBed.inject(DeliveryAssignmentsStore);

      await store.loadAssignments();

      expect(store.groups().active).toEqual([cachedAssignment]);
      expect(store.activeAssignmentStatus()).toBe('stale');
      expect(store.error()).toBeNull(); // a useful cached view is shown, not a scary error
    });

    it('shows a proper offline/empty state, not fake data, when there is no cache either', async () => {
      assignmentsService.getAssignments.mockRejectedValue(new Error('offline'));
      cache.read.mockResolvedValue(null);
      networkStatus.isOffline.mockReturnValue(true);
      const store = TestBed.inject(DeliveryAssignmentsStore);

      await store.loadAssignments();

      expect(store.groups().active).toEqual([]);
      expect(store.activeAssignmentStatus()).toBe('offline');
    });

    it('shows an error state (not offline) when the fetch fails, there is no cache, and the device is online', async () => {
      assignmentsService.getAssignments.mockRejectedValue(
        new Error('server exploded'),
      );
      cache.read.mockResolvedValue(null);
      networkStatus.isOffline.mockReturnValue(false);
      const store = TestBed.inject(DeliveryAssignmentsStore);

      await store.loadAssignments();

      expect(store.activeAssignmentStatus()).toBe('error');
      expect(store.error()).not.toBeNull();
    });

    it('does not crash when the cache read rejects outright', async () => {
      assignmentsService.getAssignments.mockRejectedValue(new Error('offline'));
      cache.read.mockRejectedValue(new Error('storage exploded'));
      const store = TestBed.inject(DeliveryAssignmentsStore);

      await expect(store.loadAssignments()).resolves.toBeUndefined();
    });

    it('reflects a stale cache entry (past TTL) as stale, not fresh', async () => {
      assignmentsService.getAssignments.mockRejectedValue(new Error('offline'));
      cache.read.mockResolvedValue(cachedResult(buildAssignment(), true));
      const store = TestBed.inject(DeliveryAssignmentsStore);

      await store.loadAssignments();

      expect(store.activeAssignmentStatus()).toBe('stale');
    });
  });

  describe('revalidation replacing cache/state', () => {
    it('a successful revalidation replaces previously-cached data and marks it fresh', async () => {
      assignmentsService.getAssignments.mockRejectedValueOnce(
        new Error('offline'),
      );
      cache.read.mockResolvedValue(
        cachedResult(buildAssignment({ id: 'stale-one' })),
      );
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();
      expect(store.activeAssignmentStatus()).toBe('stale');

      const fresh = buildAssignment({ id: 'fresh-one' });
      assignmentsService.getAssignments.mockResolvedValue([fresh]);
      await store.loadAssignments();

      expect(store.groups().active).toEqual([fresh]);
      expect(store.activeAssignmentStatus()).toBe('fresh');
      expect(cache.write).toHaveBeenCalledWith(fresh);
    });

    it('a failed revalidation preserves the already-displayed data and marks it stale, without wiping it', async () => {
      const active = buildAssignment();
      assignmentsService.getAssignments.mockResolvedValueOnce([active]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();
      expect(store.activeAssignmentStatus()).toBe('fresh');

      assignmentsService.getAssignments.mockRejectedValueOnce(
        new Error('network blip'),
      );
      await store.loadAssignments();

      expect(store.groups().active).toEqual([active]); // never blanked — this is the M1 R-07 fix
      expect(store.activeAssignmentStatus()).toBe('stale');
    });

    it('does not surface an error banner for a silent background poll failure that preserves data', async () => {
      const active = buildAssignment();
      assignmentsService.getAssignments.mockResolvedValueOnce([active]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      assignmentsService.getAssignments.mockRejectedValueOnce(
        new Error('network blip'),
      );
      store.startPolling(); // triggers the silent path indirectly is covered elsewhere; direct check:
      await flush();

      expect(store.error()).toBeNull();
    });
  });

  describe('app resume / reconnect revalidation', () => {
    it('app resume triggers a silent revalidation when the shown data is not confirmed fresh', async () => {
      assignmentsService.getAssignments.mockRejectedValue(new Error('offline'));
      cache.read.mockResolvedValue(cachedResult(buildAssignment()));
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();
      expect(store.activeAssignmentStatus()).toBe('stale');

      const fresh = buildAssignment({ id: 'revalidated' });
      assignmentsService.getAssignments.mockResolvedValue([fresh]);
      resumeCallback?.();
      await flush();

      expect(store.groups().active).toEqual([fresh]);
      expect(store.activeAssignmentStatus()).toBe('fresh');
    });

    it('app resume does nothing extra when data is already confirmed fresh', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();
      expect(assignmentsService.getAssignments).toHaveBeenCalledTimes(1);

      resumeCallback?.();
      await flush();

      expect(assignmentsService.getAssignments).toHaveBeenCalledTimes(1); // no redundant fetch
    });

    it('network reconnect triggers a silent revalidation when stale', async () => {
      assignmentsService.getAssignments.mockRejectedValue(new Error('offline'));
      cache.read.mockResolvedValue(cachedResult(buildAssignment()));
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      const fresh = buildAssignment({ id: 'reconnected' });
      assignmentsService.getAssignments.mockResolvedValue([fresh]);
      window.dispatchEvent(new Event('online'));
      await flush();

      expect(store.groups().active).toEqual([fresh]);
      expect(store.activeAssignmentStatus()).toBe('fresh');
    });
  });

  describe('concurrency (M3.9)', () => {
    it('overlapping fetch triggers coalesce into a single in-flight request', async () => {
      let resolveFetch: (value: DeliveryAssignmentResponseDto[]) => void = () =>
        undefined;
      assignmentsService.getAssignments.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );
      const store = TestBed.inject(DeliveryAssignmentsStore);

      const first = store.loadAssignments();
      const second = store.loadAssignments();
      resumeCallback?.(); // a third trigger, arriving while the first is still in flight

      resolveFetch([buildAssignment()]);
      await first;
      await second;
      await flush();

      expect(assignmentsService.getAssignments).toHaveBeenCalledTimes(1);
    });
  });

  describe('mutation safety (M3.10) — no offline queue', () => {
    it('refuses acceptAssignment while offline without calling the backend or faking success', async () => {
      assignmentsService.getAssignments.mockResolvedValue([
        buildAssignment({ status: 'PENDING', order: undefined }),
      ]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      networkStatus.isOffline.mockReturnValue(true);
      await store.acceptAssignment('assignment-1');

      expect(assignmentsService.acceptAssignment).not.toHaveBeenCalled();
      expect(store.actionError()).toMatch(/offline/i);
      // The assignment must not have been optimistically flipped to ACCEPTED locally.
      expect(store.groups().available[0]?.status).toBe('PENDING');
    });

    it('refuses rejectAssignment while offline without calling the backend', async () => {
      assignmentsService.getAssignments.mockResolvedValue([
        buildAssignment({ status: 'PENDING', order: undefined }),
      ]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      networkStatus.isOffline.mockReturnValue(true);
      await store.rejectAssignment('assignment-1');

      expect(assignmentsService.rejectAssignment).not.toHaveBeenCalled();
      expect(store.actionError()).toMatch(/offline/i);
    });

    it('refuses to generate/verify an OTP while offline', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      networkStatus.isOffline.mockReturnValue(true);
      await store.openPickupOtpDialog('assignment-1');

      expect(assignmentsService.generatePickupOtp).not.toHaveBeenCalled();
      expect(store.otpDialog()?.error).toMatch(/offline/i);
    });

    it('never queues a mutation for later — going back online requires an explicit retry, not automatic replay', async () => {
      assignmentsService.getAssignments.mockResolvedValue([
        buildAssignment({ status: 'PENDING', order: undefined }),
      ]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      networkStatus.isOffline.mockReturnValue(true);
      await store.acceptAssignment('assignment-1');

      networkStatus.isOffline.mockReturnValue(false);
      window.dispatchEvent(new Event('online'));
      await flush();

      expect(assignmentsService.acceptAssignment).not.toHaveBeenCalled();
    });
  });

  describe('logout cleanup', () => {
    it('clears the active-assignment cache on logout', () => {
      TestBed.inject(DeliveryAssignmentsStore);

      logoutRegistry.runAll();

      expect(cache.clear).toHaveBeenCalled();
    });

    it('stops polling on logout (pre-existing behavior, unchanged)', async () => {
      assignmentsService.getAssignments.mockResolvedValue([]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      store.startPolling();
      await flush();

      logoutRegistry.runAll();
      assignmentsService.getAssignments.mockClear();

      jest.useFakeTimers();
      jest.advanceTimersByTime(60_000);
      jest.useRealTimers();
      await flush();

      expect(assignmentsService.getAssignments).not.toHaveBeenCalled();
    });
  });
});
