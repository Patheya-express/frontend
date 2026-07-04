import { Injectable, computed, inject, signal } from '@angular/core';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
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

@Injectable({ providedIn: 'root' })
export class RestaurantOrdersStore {
  private readonly restaurantOrdersService = inject(RestaurantOrdersService);

  private readonly _orders = signal<OrderResponseDto[]>([]);
  private readonly _selectedFilter = signal<RestaurantOrderFilter>('ALL');
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _processingOrderId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);

  private pollHandle: ReturnType<typeof setInterval> | null = null;

  readonly orders = this._orders.asReadonly();
  readonly selectedFilter = this._selectedFilter.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly processingOrderId = this._processingOrderId.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly filteredOrders = computed(() => {
    const filter = this._selectedFilter();
    const orders = this._orders();
    return filter === 'ALL' ? orders : orders.filter((order) => order.status === filter);
  });

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

  /** Loads immediately, then refreshes in the background on an interval. Safe to call more than once. */
  startPolling(intervalMs = POLL_INTERVAL_MS): void {
    if (this.pollHandle) {
      return;
    }

    void this.loadOrders();
    this.pollHandle = setInterval(() => void this.refreshSilently(), intervalMs);
  }

  stopPolling(): void {
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
