import { TestBed } from '@angular/core/testing';
import type { OrderResponseDto, PaginatedOrdersResponseDto } from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { MobilePlatformService, RealtimeSocketService } from '@patheya-express-frontend/core';
import { LiveOrdersStore, MAX_TRACKED_ORDERS } from './live-orders.store';
import { ActiveOrdersService } from '../services/active-orders.service';

function makeOrder(overrides: Partial<OrderResponseDto> & { id: string; createdAt: string }): OrderResponseDto {
  return {
    orderNumber: `PE-${overrides.id}`,
    status: 'PENDING',
    paymentMode: 'COD',
    paymentStatus: 'PENDING',
    customerId: 'customer-1',
    restaurantId: 'restaurant-1',
    deliveryAddress: '123 Main St',
    deliveryFee: 40,
    discountAmount: 0,
    items: [],
    statusHistory: [],
    subtotalAmount: 100,
    taxAmount: 5,
    totalAmount: 145,
    ...overrides,
  } as OrderResponseDto;
}

function paginated(items: OrderResponseDto[]): PaginatedOrdersResponseDto {
  return { items, limit: 20, page: 1, total: items.length, totalPages: 1 };
}

describe('LiveOrdersStore', () => {
  let getRecentOrdersMock: jest.Mock;
  let joinRoomMock: jest.Mock;
  let onMock: jest.Mock;
  let statusHandler: ((payload: { orderId: string; status: OrderResponseDto['status'] }) => void) | undefined;
  let onResumeCallback: (() => void) | undefined;
  let logoutHandlers: Array<() => void>;
  let store: LiveOrdersStore;

  beforeEach(() => {
    getRecentOrdersMock = jest.fn().mockResolvedValue(paginated([]));
    joinRoomMock = jest.fn().mockResolvedValue(true);
    statusHandler = undefined;
    onMock = jest.fn((_event: string, handler: typeof statusHandler) => {
      statusHandler = handler;
      return jest.fn();
    });
    onResumeCallback = undefined;
    logoutHandlers = [];

    TestBed.configureTestingModule({
      providers: [
        { provide: ActiveOrdersService, useValue: { getRecentOrders: getRecentOrdersMock } },
        { provide: RealtimeSocketService, useValue: { joinRoom: joinRoomMock, on: onMock } },
        {
          provide: MobilePlatformService,
          useValue: { onResume: (cb: () => void) => (onResumeCallback = cb) },
        },
        {
          provide: LogoutCleanupRegistry,
          useValue: { register: (handler: () => void) => logoutHandlers.push(handler) },
        },
      ],
    });

    store = TestBed.inject(LiveOrdersStore);
  });

  function emitStatusChange(orderId: string, status: OrderResponseDto['status']): void {
    statusHandler?.({ orderId, status });
  }

  /** Flushes the constructor's room-joining `effect()` — Angular's effect scheduler runs on its
   *  own microtask/tick, not synchronously with the signal write that triggered it. Same pattern
   *  CheckoutStore's own effect-loop regression spec uses (checkout.store.spec.ts's `settle`). */
  async function settle(rounds = 4): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      TestBed.tick();
      await Promise.resolve();
    }
  }

  it('TC01 — shows nothing when there are no active orders', async () => {
    await store.initialize();
    expect(store.trackedOrders()).toEqual([]);
  });

  it('TC02/03/04 — tracks up to 3 orders one-for-one', async () => {
    getRecentOrdersMock.mockResolvedValue(
      paginated([
        makeOrder({ id: '1', createdAt: '2026-01-01T10:00:00Z' }),
        makeOrder({ id: '2', createdAt: '2026-01-01T10:05:00Z' }),
        makeOrder({ id: '3', createdAt: '2026-01-01T10:10:00Z' }),
      ]),
    );

    await store.initialize();

    expect(store.trackedOrders()).toHaveLength(3);
  });

  it('TC05/06 — caps the tracker at 3 but keeps every active order in state', async () => {
    getRecentOrdersMock.mockResolvedValue(
      paginated([
        makeOrder({ id: '1', createdAt: '2026-01-01T10:00:00Z' }),
        makeOrder({ id: '2', createdAt: '2026-01-01T10:05:00Z' }),
        makeOrder({ id: '3', createdAt: '2026-01-01T10:10:00Z' }),
        makeOrder({ id: '4', createdAt: '2026-01-01T10:15:00Z' }),
        makeOrder({ id: '5', createdAt: '2026-01-01T10:20:00Z' }),
      ]),
    );

    await store.initialize();

    expect(store.trackedOrders()).toHaveLength(MAX_TRACKED_ORDERS);
    expect(store.activeOrders()).toHaveLength(5);
  });

  it('TC07/08 — sorts newest-first by createdAt, never by status', async () => {
    getRecentOrdersMock.mockResolvedValue(
      paginated([
        // Older order, but a further-along status — must still sort behind the newer one.
        makeOrder({ id: 'old', createdAt: '2026-01-01T10:00:00Z', status: 'OUT_FOR_DELIVERY' }),
        makeOrder({ id: 'new', createdAt: '2026-01-01T11:00:00Z', status: 'PENDING' }),
      ]),
    );

    await store.initialize();

    expect(store.trackedOrders().map((o) => o.id)).toEqual(['new', 'old']);
  });

  it('TC09 — a newly placed order (upsertOrder) becomes first, still capped at 3', async () => {
    getRecentOrdersMock.mockResolvedValue(
      paginated([
        makeOrder({ id: '1', createdAt: '2026-01-01T10:00:00Z' }),
        makeOrder({ id: '2', createdAt: '2026-01-01T10:05:00Z' }),
        makeOrder({ id: '3', createdAt: '2026-01-01T10:10:00Z' }),
      ]),
    );

    await store.initialize();
    store.upsertOrder(makeOrder({ id: 'new', createdAt: '2026-01-01T10:30:00Z' }));

    expect(store.trackedOrders().map((o) => o.id)).toEqual(['new', '3', '2']);
    expect(store.activeOrders()).toHaveLength(4);
  });

  it('TC10 — a realtime status-changed event patches the order in place, no refetch', async () => {
    getRecentOrdersMock.mockResolvedValue(
      paginated([makeOrder({ id: '1', createdAt: '2026-01-01T10:00:00Z', status: 'PREPARING' })]),
    );

    await store.initialize();
    getRecentOrdersMock.mockClear();
    emitStatusChange('1', 'OUT_FOR_DELIVERY');

    expect(store.trackedOrders()[0].status).toBe('OUT_FOR_DELIVERY');
    expect(getRecentOrdersMock).not.toHaveBeenCalled();
  });

  it('TC11/TC12 — DELIVERED and CANCELLED orders disappear from the tracker', async () => {
    getRecentOrdersMock.mockResolvedValue(
      paginated([
        makeOrder({ id: '1', createdAt: '2026-01-01T10:00:00Z' }),
        makeOrder({ id: '2', createdAt: '2026-01-01T10:05:00Z' }),
      ]),
    );

    await store.initialize();
    emitStatusChange('1', 'DELIVERED');
    emitStatusChange('2', 'CANCELLED');

    expect(store.trackedOrders()).toEqual([]);
  });

  it('TC13 — promotes the next-newest active order into the freed slot', async () => {
    getRecentOrdersMock.mockResolvedValue(
      paginated([
        makeOrder({ id: '1', createdAt: '2026-01-01T10:00:00Z' }),
        makeOrder({ id: '2', createdAt: '2026-01-01T10:05:00Z' }),
        makeOrder({ id: '3', createdAt: '2026-01-01T10:10:00Z' }),
        makeOrder({ id: '4', createdAt: '2026-01-01T10:15:00Z' }),
      ]),
    );

    await store.initialize();
    expect(store.trackedOrders().map((o) => o.id)).toEqual(['4', '3', '2']);

    emitStatusChange('4', 'DELIVERED');

    expect(store.trackedOrders().map((o) => o.id)).toEqual(['3', '2', '1']);
  });

  it('TC18 — logout clears tracked orders', async () => {
    getRecentOrdersMock.mockResolvedValue(paginated([makeOrder({ id: '1', createdAt: '2026-01-01T10:00:00Z' })]));

    await store.initialize();
    expect(store.trackedOrders()).toHaveLength(1);

    logoutHandlers.forEach((handler) => handler());

    expect(store.trackedOrders()).toEqual([]);
  });

  it('TC19 — a fresh login (initialize after reset) reloads that customer’s active orders', async () => {
    getRecentOrdersMock.mockResolvedValue(paginated([makeOrder({ id: '1', createdAt: '2026-01-01T10:00:00Z' })]));
    await store.initialize();
    logoutHandlers.forEach((handler) => handler());

    getRecentOrdersMock.mockResolvedValue(paginated([makeOrder({ id: '2', createdAt: '2026-01-02T10:00:00Z' })]));
    await store.initialize();

    expect(store.trackedOrders().map((o) => o.id)).toEqual(['2']);
  });

  it('TC21/TC23 — never registers more than one realtime status listener', async () => {
    await store.initialize();
    await store.initialize();

    expect(onMock).toHaveBeenCalledTimes(1);
  });

  it('TC22 — app resume triggers exactly one re-sync fetch, not a poll', async () => {
    await store.initialize();
    getRecentOrdersMock.mockClear();

    onResumeCallback?.();
    await Promise.resolve();

    expect(getRecentOrdersMock).toHaveBeenCalledTimes(1);
  });

  it('regression: a corrective refresh self-heals a status-changed event Socket.IO dropped during the room-join window', async () => {
    // Reproduces the floating-tracker desync bug (2026-09-16): a status-changed event for this
    // order fires (e.g. the restaurant accepting within seconds of order placement) before this
    // client's room join for it has finished — Socket.IO never replays that missed broadcast, so
    // without a corrective resync the tracker would stay on PENDING until some *later* event
    // patched it. Here, that never-delivered event is simulated by the GET simply never being
    // told about it directly — the corrective refresh() (triggered once the room join settles)
    // is what picks up the true current status instead.
    getRecentOrdersMock.mockResolvedValueOnce(
      paginated([makeOrder({ id: '1', createdAt: '2026-01-01T10:00:00Z', status: 'PENDING' })]),
    );

    await store.initialize();
    expect(store.trackedOrders()[0].status).toBe('PENDING');

    getRecentOrdersMock.mockResolvedValueOnce(
      paginated([makeOrder({ id: '1', createdAt: '2026-01-01T10:00:00Z', status: 'CONFIRMED' })]),
    );

    await settle();

    expect(store.trackedOrders()[0].status).toBe('CONFIRMED');
    expect(getRecentOrdersMock).toHaveBeenCalledTimes(2);
  });

  it('joins the realtime room for each newly-known active order exactly once', async () => {
    getRecentOrdersMock.mockResolvedValue(
      paginated([
        makeOrder({ id: '1', createdAt: '2026-01-01T10:00:00Z' }),
        makeOrder({ id: '2', createdAt: '2026-01-01T10:05:00Z' }),
      ]),
    );
    await store.initialize();
    await settle();

    expect(joinRoomMock).toHaveBeenCalledWith('order:1');
    expect(joinRoomMock).toHaveBeenCalledWith('order:2');
    expect(joinRoomMock).toHaveBeenCalledTimes(2);

    joinRoomMock.mockClear();
    emitStatusChange('1', 'PREPARING');
    await settle();

    // Same order, already joined — must not rejoin on every status update.
    expect(joinRoomMock).not.toHaveBeenCalled();
  });
});
