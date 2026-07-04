import { Injectable, inject, signal } from '@angular/core';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { OrderDetailsService } from '../services/order-details.service';

@Injectable({ providedIn: 'root' })
export class OrderListStore {
  private readonly orderDetailsService = inject(OrderDetailsService);

  private readonly _orders = signal<OrderResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly orders = this._orders.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  async loadOrders(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const orders = await this.orderDetailsService.getCustomerOrders();
      this._orders.set(orders);
    } catch {
      this._error.set('Unable to load your orders. Please try again.');
      this._orders.set([]);
    } finally {
      this._loading.set(false);
    }
  }
}
