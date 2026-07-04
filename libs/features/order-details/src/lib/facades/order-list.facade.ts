import { Injectable, inject } from '@angular/core';
import { OrderListStore } from '../store/order-list.store';

@Injectable({ providedIn: 'root' })
export class OrderListFacade {
  private readonly store = inject(OrderListStore);

  readonly orders = this.store.orders;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  loadOrders(): Promise<void> {
    return this.store.loadOrders();
  }
}
