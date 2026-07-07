import { Injectable, inject } from '@angular/core';
import { OrderDetailsStore } from '../store/order-details.store';

@Injectable({ providedIn: 'root' })
export class OrderDetailsFacade {
  private readonly store = inject(OrderDetailsStore);

  readonly order = this.store.order;
  readonly restaurantName = this.store.restaurantName;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  /** Starts loading the order and begins background polling until it reaches a terminal status. */
  initialize(orderId: string): void {
    this.store.startPolling(orderId);
  }

  /** Stops background polling. Call on page destroy. */
  dispose(): void {
    this.store.stopPolling();
  }

  retry(orderId: string): Promise<void> {
    return this.store.loadOrder(orderId);
  }
}
