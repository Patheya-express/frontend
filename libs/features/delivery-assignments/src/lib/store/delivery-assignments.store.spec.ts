import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { DeliveryAssignmentResponseDto } from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import {
  GeolocationService,
  MobilePlatformService,
  RealtimeSocketService,
} from '@patheya-express-frontend/core';
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
      pickupPhotoUploaded: false,
    },
    ...overrides,
  };
}

describe('DeliveryAssignmentsStore — M3 offline resilience', () => {
  let assignmentsService: {
    getAssignments: jest.Mock;
    acceptAssignment: jest.Mock;
    rejectAssignment: jest.Mock;
    confirmPickup: jest.Mock;
    generateDeliveryOtp: jest.Mock;
    verifyDeliveryOtp: jest.Mock;
    uploadPickupPhoto: jest.Mock;
    markRestaurantArrival: jest.Mock;
  };
  let cache: { read: jest.Mock; write: jest.Mock; clear: jest.Mock };
  let networkStatus: { isOffline: jest.Mock; isOnline: jest.Mock };
  let resumeCallback: (() => void) | undefined;
  let mobilePlatform: { isNative: jest.Mock; onResume: jest.Mock };
  let geolocationService: {
    ensurePermission: jest.Mock;
    getCurrentPosition: jest.Mock;
  };
  let logoutRegistry: LogoutCleanupRegistry;
  let realtimeHandlers: Map<string, () => void>;
  let realtimeUnsubscribe: jest.Mock;

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
      confirmPickup: jest.fn().mockResolvedValue(undefined),
      generateDeliveryOtp: jest.fn(),
      verifyDeliveryOtp: jest.fn(),
      uploadPickupPhoto: jest.fn(),
      markRestaurantArrival: jest.fn(),
    };

    geolocationService = {
      ensurePermission: jest.fn().mockResolvedValue(true),
      getCurrentPosition: jest
        .fn()
        .mockResolvedValue({
          coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 12 },
        }),
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

    realtimeHandlers = new Map();
    realtimeUnsubscribe = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: RealtimeSocketService,
          useValue: {
            on: jest.fn((event: string, handler: () => void) => {
              realtimeHandlers.set(event, handler);
              return realtimeUnsubscribe;
            }),
          },
        },
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
        { provide: GeolocationService, useValue: geolocationService },
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
      await store.openDeliveryOtpDialog('assignment-1');

      expect(assignmentsService.generateDeliveryOtp).not.toHaveBeenCalled();
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

  describe('pickup-photo dialog', () => {
    beforeEach(() => {
      URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-preview');
      URL.revokeObjectURL = jest.fn();
    });

    function buildFile(): File {
      return new File(['fake'], 'parcel.jpg', { type: 'image/jpeg' });
    }

    it('does nothing if the assignment has no order', async () => {
      const store = TestBed.inject(DeliveryAssignmentsStore);
      store.openPickupPhotoDialog('does-not-exist');

      expect(store.pickupPhotoDialog()).toBeNull();
    });

    it('opens with the assignment/order ids and no file yet', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      store.openPickupPhotoDialog('assignment-1');

      expect(store.pickupPhotoDialog()).toMatchObject({
        assignmentId: 'assignment-1',
        orderId: 'order-1',
        file: null,
        uploading: false,
        error: null,
      });
    });

    it('selecting a file sets a local preview without calling the backend', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();
      store.openPickupPhotoDialog('assignment-1');

      const file = buildFile();
      await store.selectPickupPhoto(file);

      expect(store.pickupPhotoDialog()?.file).toBe(file);
      expect(store.pickupPhotoDialog()?.previewUrl).toBe('blob:mock-preview');
      expect(assignmentsService.uploadPickupPhoto).not.toHaveBeenCalled();
    });

    it('submitting refuses while offline, without calling the backend', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();
      store.openPickupPhotoDialog('assignment-1');
      await store.selectPickupPhoto(buildFile());

      networkStatus.isOffline.mockReturnValue(true);
      await store.submitPickupPhoto();

      expect(assignmentsService.uploadPickupPhoto).not.toHaveBeenCalled();
      expect(store.pickupPhotoDialog()?.error).toMatch(/offline/i);
    });

    it('on success, marks the order pickupPhotoUploaded and closes the dialog', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      assignmentsService.uploadPickupPhoto.mockResolvedValue({ id: 'photo-1' });
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();
      store.openPickupPhotoDialog('assignment-1');
      await store.selectPickupPhoto(buildFile());

      await store.submitPickupPhoto();

      expect(assignmentsService.uploadPickupPhoto).toHaveBeenCalledWith(
        'order-1',
        expect.any(File),
      );
      expect(store.pickupPhotoDialog()).toBeNull();
      expect(
        store.groups().active.find((a) => a.id === 'assignment-1')?.order
          ?.pickupPhotoUploaded,
      ).toBe(true);
    });

    it('on failure, keeps the dialog open with an error and does not mark the order', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      assignmentsService.uploadPickupPhoto.mockRejectedValue(new Error('boom'));
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();
      store.openPickupPhotoDialog('assignment-1');
      await store.selectPickupPhoto(buildFile());

      await store.submitPickupPhoto();

      expect(store.pickupPhotoDialog()?.uploading).toBe(false);
      expect(store.pickupPhotoDialog()?.error).toBeTruthy();
      expect(
        store.groups().active.find((a) => a.id === 'assignment-1')?.order
          ?.pickupPhotoUploaded,
      ).toBe(false);
    });

    it('closing revokes the preview object URL', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();
      store.openPickupPhotoDialog('assignment-1');
      await store.selectPickupPhoto(buildFile());

      store.closePickupPhotoDialog();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview');
      expect(store.pickupPhotoDialog()).toBeNull();
    });
  });

  describe('markRestaurantArrival — 2026-09-16 business-workflow revision', () => {
    it('does nothing if the assignment has no order', async () => {
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.markRestaurantArrival('does-not-exist');

      expect(assignmentsService.markRestaurantArrival).not.toHaveBeenCalled();
    });

    it('refuses while offline, without checking geolocation or calling the backend', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      networkStatus.isOffline.mockReturnValue(true);
      await store.markRestaurantArrival('assignment-1');

      expect(geolocationService.ensurePermission).not.toHaveBeenCalled();
      expect(assignmentsService.markRestaurantArrival).not.toHaveBeenCalled();
      expect(store.actionError()).toMatch(/offline/i);
    });

    it('sets a clear error and does not call the backend when location permission is denied', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      geolocationService.ensurePermission.mockResolvedValue(false);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      await store.markRestaurantArrival('assignment-1');

      expect(assignmentsService.markRestaurantArrival).not.toHaveBeenCalled();
      expect(store.actionError()).toMatch(/location/i);
    });

    it('surfaces the backend geofence rejection message (e.g. too far away) without touching assignment state', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      assignmentsService.markRestaurantArrival.mockRejectedValue(
        new HttpErrorResponse({
          error: {
            message:
              'You are 342m from the restaurant — move within 100m to mark arrival',
          },
        }),
      );
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      await store.markRestaurantArrival('assignment-1');

      expect(store.actionError()).toMatch(/342m/);
      expect(
        store.groups().active.find((a) => a.id === 'assignment-1')
          ?.arrivedAtRestaurantAt,
      ).toBeUndefined();
    });

    it('on success, submits the device position and patches arrivedAtRestaurantAt onto the assignment', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      assignmentsService.markRestaurantArrival.mockResolvedValue({
        orderId: 'order-1',
        arrivedAtRestaurantAt: '2026-09-16T10:00:00.000Z',
      });
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      await store.markRestaurantArrival('assignment-1');

      expect(assignmentsService.markRestaurantArrival).toHaveBeenCalledWith(
        'order-1',
        12.9716,
        77.5946,
      );
      expect(
        store.groups().active.find((a) => a.id === 'assignment-1')
          ?.arrivedAtRestaurantAt,
      ).toBe('2026-09-16T10:00:00.000Z');
      expect(store.actionError()).toBeNull();
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
  describe('confirmPickup — 2026-10-11 pickup revision (photo-gated, no pickup OTP)', () => {
    function awaitingPickup(): DeliveryAssignmentResponseDto {
      const assignment = buildAssignment({
        arrivedAtRestaurantAt: '2026-10-11T10:00:00.000Z',
      });
      if (!assignment.order) {
        throw new Error('fixture must include an order');
      }
      return {
        ...assignment,
        order: {
          ...assignment.order,
          status: 'READY_FOR_PICKUP',
          pickupPhotoUploaded: true,
        },
      };
    }

    it('advances the order to OUT_FOR_DELIVERY through the delivery-status endpoint', async () => {
      assignmentsService.getAssignments.mockResolvedValue([awaitingPickup()]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      await store.confirmPickup('assignment-1');

      expect(assignmentsService.confirmPickup).toHaveBeenCalledWith('order-1');
      expect(store.groups().active[0].order?.status).toBe('OUT_FOR_DELIVERY');
      expect(store.actionError()).toBeNull();
    });

    it('rolls back and shows the backend reason when pickup is refused (e.g. no photo)', async () => {
      assignmentsService.getAssignments.mockResolvedValue([awaitingPickup()]);
      assignmentsService.confirmPickup.mockRejectedValue(
        new HttpErrorResponse({
          status: 403,
          error: {
            message:
              'A pickup photo is required before marking this order as OUT_FOR_DELIVERY',
          },
        }),
      );
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();
      assignmentsService.getAssignments.mockClear();

      await store.confirmPickup('assignment-1');
      await flush();

      expect(store.groups().active[0].order?.status).toBe('READY_FOR_PICKUP');
      expect(store.actionError()).toMatch(/pickup photo is required/);
      // A 4xx means local state is stale — the authoritative list is re-fetched.
      expect(assignmentsService.getAssignments).toHaveBeenCalled();
    });

    it('refuses while offline without calling the backend', async () => {
      assignmentsService.getAssignments.mockResolvedValue([awaitingPickup()]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      networkStatus.isOffline.mockReturnValue(true);
      await store.confirmPickup('assignment-1');

      expect(assignmentsService.confirmPickup).not.toHaveBeenCalled();
      expect(store.actionError()).toMatch(/offline/i);
    });
  });

  describe('accept/reject failures', () => {
    it('shows the backend reason for a stale offer and re-fetches the list', async () => {
      assignmentsService.getAssignments.mockResolvedValue([
        buildAssignment({ status: 'PENDING', order: undefined }),
      ]);
      assignmentsService.acceptAssignment.mockRejectedValue(
        new HttpErrorResponse({
          status: 400,
          error: { message: 'Only pending assignments can be accepted' },
        }),
      );
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();
      assignmentsService.getAssignments.mockClear();

      await store.acceptAssignment('assignment-1');
      await flush();

      expect(store.actionError()).toBe(
        'Only pending assignments can be accepted',
      );
      expect(store.groups().available[0]?.status).toBe('PENDING');
      expect(assignmentsService.getAssignments).toHaveBeenCalled();
    });

    it('keeps the generic message for a failure without a backend message', async () => {
      assignmentsService.getAssignments.mockResolvedValue([
        buildAssignment({ status: 'PENDING', order: undefined }),
      ]);
      assignmentsService.acceptAssignment.mockRejectedValue(new Error('boom'));
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      await store.acceptAssignment('assignment-1');

      expect(store.actionError()).toBe(
        'Unable to update this assignment. Please try again.',
      );
    });
  });

  describe('realtime new-assignment refresh', () => {
    it('re-fetches the list as soon as a delivery.assignment event arrives while polling', async () => {
      const store = TestBed.inject(DeliveryAssignmentsStore);
      store.startPolling();
      await flush();
      assignmentsService.getAssignments.mockClear();

      realtimeHandlers.get('delivery.assignment')?.();
      await flush();

      expect(assignmentsService.getAssignments).toHaveBeenCalledTimes(1);
      store.stopPolling();
    });

    it('unsubscribes from delivery.assignment when polling stops', async () => {
      const store = TestBed.inject(DeliveryAssignmentsStore);
      store.startPolling();
      await flush();

      store.stopPolling();

      expect(realtimeUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('restaurant arrival — GPS accuracy guard', () => {
    it('does not submit a fix whose accuracy is worse than the 100m arrival radius', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      geolocationService.getCurrentPosition.mockResolvedValue({
        coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 450 },
      });
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();

      await store.markRestaurantArrival('assignment-1');

      expect(assignmentsService.markRestaurantArrival).not.toHaveBeenCalled();
      expect(store.actionError()).toMatch(/GPS signal is too weak.*450m/);
    });
  });

  describe('pickup-photo validation', () => {
    it('rejects an unsupported file type and keeps Submit disabled', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();
      store.openPickupPhotoDialog('assignment-1');

      await store.selectPickupPhoto(
        new File(['gif'], 'parcel.gif', { type: 'image/gif' }),
      );

      expect(store.pickupPhotoDialog()?.file).toBeNull();
      expect(store.pickupPhotoDialog()?.error).toMatch(/JPG, PNG or WebP/);
    });

    it('rejects a photo over 5 MB that cannot be downscaled on this device', async () => {
      assignmentsService.getAssignments.mockResolvedValue([buildAssignment()]);
      const store = TestBed.inject(DeliveryAssignmentsStore);
      await store.loadAssignments();
      store.openPickupPhotoDialog('assignment-1');
      const oversized = new File(
        [new Uint8Array(5 * 1024 * 1024 + 1)],
        'big.jpg',
        {
          type: 'image/jpeg',
        },
      );

      await store.selectPickupPhoto(oversized);

      expect(store.pickupPhotoDialog()?.file).toBeNull();
      expect(store.pickupPhotoDialog()?.error).toMatch(/larger than 5 MB/);
    });
  });
});
