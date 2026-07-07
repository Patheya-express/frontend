import { Injectable, inject, signal } from '@angular/core';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { OrderDetailsService } from '../services/order-details.service';

const TERMINAL_ORDER_STATUSES: ReadonlyArray<OrderResponseDto['status']> = ['DELIVERED', 'CANCELLED'];
const POLL_INTERVAL_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class OrderDetailsStore {
  private readonly orderDetailsService = inject(OrderDetailsService);

  private readonly _order = signal<OrderResponseDto | null>(null);
  private readonly _restaurantName = signal<string | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private orderId = '';

  readonly order = this._order.asReadonly();
  readonly restaurantName = this._restaurantName.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  async loadOrder(orderId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const details = await this.orderDetailsService.getOrderDetails(orderId);
      this._order.set(details.order);
      this._restaurantName.set(details.restaurantName);
    } catch {
      this._error.set('Unable to load this order. It may not exist or you may not have access to it.');
      this._order.set(null);
      this._restaurantName.set(null);
    } finally {
      this._loading.set(false);
    }
  }

  /** Loads immediately, then refreshes in the background until the order reaches a terminal status. */
  startPolling(orderId: string): void {
    this.orderId = orderId;
    void this.loadOrder(orderId);

    if (this.pollHandle) {
      return;
    }
    this.pollHandle = setInterval(() => void this.refreshSilently(), POLL_INTERVAL_MS);
  }

  stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private async refreshSilently(): Promise<void> {
    const current = this._order();
    if (current && TERMINAL_ORDER_STATUSES.includes(current.status)) {
      this.stopPolling();
      return;
    }

    try {
      const details = await this.orderDetailsService.getOrderDetails(this.orderId);
      this._order.set(details.order);
      this._restaurantName.set(details.restaurantName);
      this._error.set(null);
    } catch {
      // A transient background refresh failure shouldn't blank out an already-loaded order;
      // the next successful poll tick recovers silently.
    }
  }
}
