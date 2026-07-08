import { Injectable, inject } from '@angular/core';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { OrderListStore, type OrderStatusFilter, type ReorderResult } from '../store/order-list.store';

@Injectable({ providedIn: 'root' })
export class OrderListFacade {
  private readonly store = inject(OrderListStore);

  readonly orders = this.store.orders;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly page = this.store.page;
  readonly totalPages = this.store.totalPages;
  readonly total = this.store.total;
  readonly search = this.store.search;
  readonly status = this.store.status;
  readonly dateFrom = this.store.dateFrom;
  readonly dateTo = this.store.dateTo;
  readonly hasActiveFilters = this.store.hasActiveFilters;
  readonly reorderingOrderId = this.store.reorderingOrderId;

  loadOrders(): Promise<void> {
    return this.store.loadOrders();
  }

  setSearch(value: string): void {
    this.store.setSearch(value);
  }

  setStatus(value: OrderStatusFilter): void {
    this.store.setStatus(value);
  }

  setDateRange(dateFrom: string, dateTo: string): void {
    this.store.setDateRange(dateFrom, dateTo);
  }

  clearFilters(): void {
    this.store.clearFilters();
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  reorder(order: OrderResponseDto): Promise<ReorderResult> {
    return this.store.reorder(order);
  }
}
