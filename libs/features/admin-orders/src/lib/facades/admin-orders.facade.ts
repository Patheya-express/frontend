import { Injectable, inject } from '@angular/core';
import type { AdminOrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { AdminOrdersStore, type OrderStatusFilter } from '../store/admin-orders.store';

@Injectable({ providedIn: 'root' })
export class AdminOrdersFacade {
  private readonly store = inject(AdminOrdersStore);

  readonly state = this.store.state;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly processingId = this.store.processingId;
  readonly actionError = this.store.actionError;

  /** Loads the first page of orders. Call once on page init. */
  initialize(): Promise<void> {
    return this.store.loadOrders();
  }

  refresh(): Promise<void> {
    return this.store.loadOrders();
  }

  setSearch(search: string): void {
    this.store.setSearch(search);
  }

  setStatusFilter(status: OrderStatusFilter | null): void {
    this.store.setStatusFilter(status);
  }

  setRestaurantFilter(restaurantId: string): void {
    this.store.setRestaurantFilter(restaurantId);
  }

  setDateRange(dateFrom: string, dateTo: string): void {
    this.store.setDateRange(dateFrom, dateTo);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  selectOrder(order: AdminOrderResponseDto | null): void {
    this.store.selectOrder(order);
  }

  cancelOrder(orderId: string, reason?: string): Promise<void> {
    return this.store.cancelOrder(orderId, reason);
  }

  forceCompleteOrder(orderId: string, reason?: string): Promise<void> {
    return this.store.forceCompleteOrder(orderId, reason);
  }

  refundOrder(orderId: string, reason?: string): Promise<void> {
    return this.store.refundOrder(orderId, reason);
  }

  reassignDeliveryPartner(orderId: string, deliveryPartnerId: string): Promise<void> {
    return this.store.reassignDeliveryPartner(orderId, deliveryPartnerId);
  }

  dismissActionError(): void {
    this.store.dismissActionError();
  }
}
