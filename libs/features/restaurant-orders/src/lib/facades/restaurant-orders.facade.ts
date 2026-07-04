import { Injectable, inject } from '@angular/core';
import { RestaurantOrderFilter, RestaurantOrdersStore } from '../store/restaurant-orders.store';

@Injectable({ providedIn: 'root' })
export class RestaurantOrdersFacade {
  private readonly store = inject(RestaurantOrdersStore);

  readonly orders = this.store.filteredOrders;
  readonly selectedFilter = this.store.selectedFilter;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly processingOrderId = this.store.processingOrderId;
  readonly actionError = this.store.actionError;

  /** Starts the order list loading and begins background polling. Call once on page init. */
  initialize(): void {
    this.store.startPolling();
  }

  /** Stops background polling. Call on page destroy. */
  dispose(): void {
    this.store.stopPolling();
  }

  setFilter(filter: RestaurantOrderFilter): void {
    this.store.setFilter(filter);
  }

  refresh(): Promise<void> {
    return this.store.loadOrders();
  }

  acceptOrder(orderId: string): Promise<void> {
    return this.store.acceptOrder(orderId);
  }

  rejectOrder(orderId: string): Promise<void> {
    return this.store.rejectOrder(orderId);
  }

  prepareOrder(orderId: string): Promise<void> {
    return this.store.prepareOrder(orderId);
  }

  readyOrder(orderId: string): Promise<void> {
    return this.store.readyOrder(orderId);
  }

  dismissActionError(): void {
    this.store.dismissActionError();
  }
}
