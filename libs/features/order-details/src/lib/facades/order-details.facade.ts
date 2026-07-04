import { Injectable, inject } from '@angular/core';
import { OrderDetailsStore } from '../store/order-details.store';

@Injectable({ providedIn: 'root' })
export class OrderDetailsFacade {
  private readonly store = inject(OrderDetailsStore);

  readonly order = this.store.order;
  readonly restaurantName = this.store.restaurantName;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  loadOrder(orderId: string): Promise<void> {
    return this.store.loadOrder(orderId);
  }
}
