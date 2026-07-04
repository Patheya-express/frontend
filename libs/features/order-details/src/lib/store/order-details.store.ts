import { Injectable, inject, signal } from '@angular/core';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { OrderDetailsService } from '../services/order-details.service';

@Injectable({ providedIn: 'root' })
export class OrderDetailsStore {
  private readonly orderDetailsService = inject(OrderDetailsService);

  private readonly _order = signal<OrderResponseDto | null>(null);
  private readonly _restaurantName = signal<string | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

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
}
