import { Injectable, inject } from '@angular/core';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { CheckoutStore, type PaymentMode } from '../store/checkout.store';

@Injectable({ providedIn: 'root' })
export class CheckoutFacade {
  private readonly store = inject(CheckoutStore);

  readonly paymentMode = this.store.paymentMode;
  readonly useWallet = this.store.useWallet;
  readonly placingOrder = this.store.placingOrder;
  readonly orderSummary = this.store.orderSummary;
  readonly validationErrors = this.store.validationErrors;
  readonly error = this.store.error;

  setPaymentMode(mode: PaymentMode): void {
    this.store.setPaymentMode(mode);
  }

  setUseWallet(useWallet: boolean): void {
    this.store.setUseWallet(useWallet);
  }

  placeOrder(): Promise<OrderResponseDto | null> {
    return this.store.placeOrder();
  }
}
