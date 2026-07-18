import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { RealtimeSocketService, RestaurantContextService } from '@patheya-express-frontend/core';
import { RestaurantOrdersService } from '../services/restaurant-orders.service';

export type RestaurantOrderFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'DELIVERED';

export const RESTAURANT_ORDER_FILTERS: ReadonlyArray<{ value: RestaurantOrderFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Accepted' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'READY_FOR_PICKUP', label: 'Ready' },
  { value: 'DELIVERED', label: 'Completed' },
];

const POLL_INTERVAL_MS = 15_000;

/** Events pushed into the `restaurant:<id>` room that mean "the order list is now stale" —
 *  see RestaurantOrderNotificationListener and OrdersService.handleAcceptanceTimeout on the
 *  backend. */
const RESTAURANT_ROOM_REFRESH_EVENTS = [
  'order.new',
  'order.cancelled',
  'order.refunded',
  'order.acceptance-timeout',
] as const;

@Injectable({ providedIn: 'root' })
export class RestaurantOrdersStore {
  private readonly restaurantOrdersService = inject(RestaurantOrdersService);
  private readonly realtimeSocketService = inject(RealtimeSocketService);
  private readonly currentRestaurant = inject(RestaurantContextService);
  private readonly authFacade = inject(AuthFacade);

  private readonly _orders = signal<OrderResponseDto[]>([]);
  private readonly _selectedFilter = signal<RestaurantOrderFilter>('ALL');
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _processingOrderId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private unsubscribers: Array<() => void> = [];

  readonly orders = this._orders.asReadonly();
  readonly selectedFilter = this._selectedFilter.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly processingOrderId = this._processingOrderId.asReadonly();
  readonly actionError = this._actionError.asReadonly();
  /** True once the realtime socket is connected — the page can rely on push updates instead of polling. */
  readonly realtimeConnected = this.realtimeSocketService.connected;

  readonly filteredOrders = computed(() => {
    const filter = this._selectedFilter();
    const orders = this._orders();
    return filter === 'ALL' ? orders : orders.filter((order) => order.status === filter);
  });

  constructor() {
    // Realtime is the primary channel; polling only runs as a fallback for when the socket is
    // unavailable (never connects, or drops mid-session) — matches the "fall back to polling
    // only when disconnected" requirement, mirroring OrderDetailsStore's pattern.
    effect(() => {
      const connected = this.realtimeSocketService.connected();

      if (!this.started) {
        return;
      }

      if (connected) {
        this.stopPolling();
      } else {
        this.startPollingInterval();
      }
    });
  }

  setFilter(filter: RestaurantOrderFilter): void {
    this._selectedFilter.set(filter);
  }

  acceptOrder(orderId: string): Promise<void> {
    return this.transitionOrder(orderId, 'CONFIRMED', (id) => this.restaurantOrdersService.acceptOrder(id));
  }

  rejectOrder(orderId: string): Promise<void> {
    return this.transitionOrder(orderId, 'CANCELLED', (id) => this.restaurantOrdersService.rejectOrder(id));
  }

  prepareOrder(orderId: string): Promise<void> {
    return this.transitionOrder(orderId, 'PREPARING', (id) => this.restaurantOrdersService.prepareOrder(id));
  }

  readyOrder(orderId: string): Promise<void> {
    return this.transitionOrder(orderId, 'READY_FOR_PICKUP', (id) => this.restaurantOrdersService.readyOrder(id));
  }

  dismissActionError(): void {
    this._actionError.set(null);
  }

  /**
   * Optimistically applies `optimisticStatus` to the order, then reconciles with the
   * server's response. Only the single affected order is ever replaced in `_orders` — the
   * rest of the list, including its sort order, is left untouched. Rolls back to the
   * original order on failure.
   *
   * Status-transition endpoints (accept/reject/etc.) return a minimal order representation
   * that omits relations like `items` and `customer` — unlike the list endpoint. Only
   * `status` is taken from that response; every other field keeps its already-loaded value.
   */
  private async transitionOrder(
    orderId: string,
    optimisticStatus: OrderResponseDto['status'],
    action: (orderId: string) => Promise<OrderResponseDto>,
  ): Promise<void> {
    const originalOrder = this._orders().find((order) => order.id === orderId);
    if (!originalOrder) {
      return;
    }

    this._processingOrderId.set(orderId);
    this.replaceOrder(orderId, { ...originalOrder, status: optimisticStatus });

    try {
      const updatedOrder = await action(orderId);
      this.replaceOrder(orderId, { ...originalOrder, status: updatedOrder.status });
      this._actionError.set(null);
    } catch {
      this.replaceOrder(orderId, originalOrder);
      this._actionError.set('Unable to update this order. Please try again.');
    } finally {
      this._processingOrderId.set(null);
    }
  }

  private replaceOrder(orderId: string, replacement: OrderResponseDto): void {
    this._orders.update((orders) => orders.map((order) => (order.id === orderId ? replacement : order)));
  }

  async loadOrders(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const orders = await this.restaurantOrdersService.getRestaurantOrders();
      this._orders.set(orders);
    } catch {
      this._error.set('Unable to load orders. Please try again.');
      this._orders.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  /** Loads immediately, joins the restaurant's realtime room for push updates, and falls back
   *  to polling only while the socket is disconnected. Safe to call more than once. */
  startSync(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    void this.loadOrders();
    void this.joinRealtimeRooms();

    if (!this.realtimeSocketService.connected()) {
      this.startPollingInterval();
    }
  }

  stopSync(): void {
    this.stopPolling();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    this.started = false;
  }

  /** Joins both the restaurant-wide room (new/cancelled/refunded/timed-out orders) and this
   *  staff member's own user room (personal `notification` events) — mirrors
   *  CustomerNotificationsStore's user-room join. */
  private async joinRealtimeRooms(): Promise<void> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const userId = this.authFacade.user()?.id;

    const [restaurantJoined, userJoined] = await Promise.all([
      this.realtimeSocketService.joinRoom(`restaurant:${restaurantId}`),
      userId ? this.realtimeSocketService.joinRoom(`user:${userId}`) : Promise.resolve(false),
    ]);

    if (!this.started) {
      return;
    }

    if (restaurantJoined) {
      this.unsubscribers.push(
        ...RESTAURANT_ROOM_REFRESH_EVENTS.map((event) =>
          this.realtimeSocketService.on(event, () => void this.refreshSilently()),
        ),
      );
    }

    if (userJoined) {
      this.unsubscribers.push(
        this.realtimeSocketService.on('notification', () => void this.refreshSilently()),
      );
    }
  }

  private startPollingInterval(): void {
    if (this.pollHandle) {
      return;
    }

    this.pollHandle = setInterval(() => void this.refreshSilently(), POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      const orders = await this.restaurantOrdersService.getRestaurantOrders();
      this._orders.set(orders);
      this._error.set(null);
    } catch {
      // A transient background refresh failure shouldn't blank out an already-loaded
      // list with an error state; the next successful poll tick recovers silently.
    }
  }
}
