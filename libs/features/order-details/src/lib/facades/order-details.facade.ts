import { Injectable, inject } from '@angular/core';
import { PaymentsCheckoutService } from '@patheya-express-frontend/core';
import { OrderDetailsStore } from '../store/order-details.store';
import { OrderDetailsService } from '../services/order-details.service';

@Injectable({ providedIn: 'root' })
export class OrderDetailsFacade {
  private readonly store = inject(OrderDetailsStore);
  private readonly paymentsCheckoutService = inject(PaymentsCheckoutService);
  private readonly orderDetailsService = inject(OrderDetailsService);

  readonly order = this.store.order;
  readonly restaurantName = this.store.restaurantName;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly location = this.store.location;
  readonly realtimeConnected = this.store.realtimeConnected;
  readonly pickupPhoto = this.store.pickupPhoto;
  readonly arrivedAtRestaurantAt = this.store.arrivedAtRestaurantAt;

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

  /**
   * Re-drives the Razorpay checkout for an order whose online payment hasn't succeeded yet.
   * Passes the remaining payable amount (totalAmount minus any wallet amount already applied)
   * as an override — the backend rejects a payment whose amount doesn't exactly match this
   * remainder (see PaymentsService.createPayment), so the wallet-mixed-payment case must not
   * default to the full order total.
   */
  async retryPayment(orderId: string): Promise<void> {
    const order = this.order();
    if (!order) {
      return;
    }

    const remainingAmount = Number(order.totalAmount) - Number(order.walletAmountUsed);
    await this.paymentsCheckoutService.payForOrder(order, remainingAmount);
    await this.store.loadOrder(orderId);
  }

  /**
   * Payment/order lifecycle Rule 4 ("Continue with COD") — switches an unpaid ONLINE order to
   * COD, reusing the existing order (never creates a new one). The backend enforces eligibility
   * (still PENDING, not already paid, caller owns the order) atomically, so a payment that
   * succeeds concurrently with this call is rejected here rather than silently overwritten —
   * returns `false` in that case (matching payForOrder's outcome-as-return-value shape) instead
   * of throwing, and reloads the order either way so the UI reflects whatever actually happened.
   */
  async continueWithCod(orderId: string): Promise<boolean> {
    try {
      await this.orderDetailsService.switchToCod(orderId);
      await this.store.loadOrder(orderId);
      return true;
    } catch {
      await this.store.loadOrder(orderId);
      return false;
    }
  }
}
