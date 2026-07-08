import { Injectable, inject } from '@angular/core';
import { PaymentsCheckoutService } from '@patheya-express-frontend/core';
import { OrderDetailsStore } from '../store/order-details.store';

@Injectable({ providedIn: 'root' })
export class OrderDetailsFacade {
  private readonly store = inject(OrderDetailsStore);
  private readonly paymentsCheckoutService = inject(PaymentsCheckoutService);

  readonly order = this.store.order;
  readonly restaurantName = this.store.restaurantName;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly location = this.store.location;
  readonly realtimeConnected = this.store.realtimeConnected;

  /** Starts loading the order, subscribes to realtime updates, and falls back to polling if the socket is unavailable. */
  initialize(orderId: string): void {
    this.store.startTracking(orderId);
  }

  /** Stops tracking (realtime subscriptions + fallback polling). Call on page destroy. */
  dispose(): void {
    this.store.stopTracking();
  }

  retry(orderId: string): Promise<void> {
    return this.store.loadOrder(orderId);
  }

  /** Re-drives the Razorpay checkout for an order whose online payment hasn't succeeded yet. */
  async retryPayment(orderId: string): Promise<void> {
    const order = this.order();
    if (!order) {
      return;
    }

    await this.paymentsCheckoutService.payForOrder(order);
    await this.store.loadOrder(orderId);
  }
}
