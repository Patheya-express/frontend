import { Injectable, inject } from '@angular/core';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { CheckoutStore } from '../store/checkout.store';

@Injectable({ providedIn: 'root' })
export class CheckoutFacade {
  private readonly store = inject(CheckoutStore);

  readonly address = this.store.address;
  readonly placingOrder = this.store.placingOrder;
  readonly orderSummary = this.store.orderSummary;
  readonly validationErrors = this.store.validationErrors;
  readonly error = this.store.error;

  setAddress(address: string): void {
    this.store.setAddress(address);
  }

  placeOrder(): Promise<OrderResponseDto | null> {
    return this.store.placeOrder();
  }
}
