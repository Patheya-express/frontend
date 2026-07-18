import { Injectable, computed, inject, signal } from '@angular/core';
import type { CreateOrderDto, OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { CartFacade, type CartItem } from '@patheya-express-frontend/cart';
import { AddressesFacade } from '@patheya-express-frontend/addresses';
import { PaymentsCheckoutService } from '@patheya-express-frontend/core';
import { CustomerWalletFacade } from '@patheya-express-frontend/customer-wallet';
import { CheckoutService } from '../services/checkout.service';

export type PaymentMode = 'ONLINE' | 'COD';

export interface OrderSummary {
  restaurantId: string | null;
  restaurantName: string | null;
  items: CartItem[];
  subtotal: number;
  totalItems: number;
  deliveryFee: number;
  taxAmount: number;
  totalAmount: number;
}

// Mirrors the fixed, server-authoritative constants in OrdersService.placeOrder — kept here only
// to preview the total before the order is placed. The order response always carries the real,
// server-computed values, which is what's actually charged and displayed after placement.
const DELIVERY_FEE = 40;
const TAX_RATE = 0.05;

@Injectable({ providedIn: 'root' })
export class CheckoutStore {
  private readonly cartFacade = inject(CartFacade);
  private readonly addressesFacade = inject(AddressesFacade);
  private readonly checkoutService = inject(CheckoutService);
  private readonly paymentsCheckoutService = inject(PaymentsCheckoutService);
  private readonly customerWalletFacade = inject(CustomerWalletFacade);

  private readonly _paymentMode = signal<PaymentMode>('ONLINE');
  private readonly _useWallet = signal(false);
  private readonly _placingOrder = signal(false);
  private readonly _validationErrors = signal<string[]>([]);
  private readonly _error = signal<string | null>(null);

  readonly paymentMode = this._paymentMode.asReadonly();
  readonly useWallet = this._useWallet.asReadonly();
  readonly placingOrder = this._placingOrder.asReadonly();
  readonly validationErrors = this._validationErrors.asReadonly();
  readonly error = this._error.asReadonly();

  readonly orderSummary = computed<OrderSummary>(() => {
    const items = this.cartFacade.items();
    const subtotal = this.cartFacade.subtotal();
    const deliveryFee = items.length > 0 ? DELIVERY_FEE : 0;
    const taxAmount = Math.round(subtotal * TAX_RATE * 100) / 100;

    return {
      restaurantId: this.cartFacade.restaurantId() ?? null,
      restaurantName: this.cartFacade.restaurantName() ?? null,
      items,
      subtotal,
      totalItems: this.cartFacade.totalItems(),
      deliveryFee,
      taxAmount,
      totalAmount: subtotal + deliveryFee + taxAmount,
    };
  });

  setPaymentMode(mode: PaymentMode): void {
    this._paymentMode.set(mode);
  }

  setUseWallet(useWallet: boolean): void {
    this._useWallet.set(useWallet);
  }

  /**
   * Validates and submits the current cart as an order. For online payment, drives the Razorpay
   * checkout widget before returning — the order is placed either way, so a failed/cancelled
   * payment still returns the order (paymentStatus stays PENDING; retryable from order details).
   */
  async placeOrder(): Promise<OrderResponseDto | null> {
    const errors = this.validate();
    this._validationErrors.set(errors);

    if (errors.length > 0) {
      return null;
    }

    const summary = this.orderSummary();
    const addressId = this.addressesFacade.selectedAddressId();
    this._placingOrder.set(true);
    this._error.set(null);

    const dto: CreateOrderDto = {
      restaurantId: summary.restaurantId as string,
      addressId: addressId as string,
      paymentMode: this._paymentMode(),
      items: summary.items.map((item) => ({
        menuItemId: item.menuItemId,
        variantId: item.variantId,
        addonOptionIds: item.addonOptions.map((option) => option.id),
        quantity: item.quantity,
        specialInstructions: item.specialInstructions,
      })),
    };

    try {
      const order = await this.checkoutService.placeOrder(dto);

      if (this._paymentMode() === 'ONLINE') {
        let remainingAmount = Number(order.totalAmount);

        if (this._useWallet()) {
          const result = await this.customerWalletFacade.applyToOrder(order.id, remainingAmount);
          remainingAmount = result?.remainingAmount ?? remainingAmount;
        }

        // Fully covered by wallet — the backend already marked the order paid, no Razorpay leg needed.
        if (remainingAmount > 0) {
          const paid = await this.paymentsCheckoutService.payForOrder(order, remainingAmount);

          if (!paid) {
            this._error.set('Payment was not completed. You can retry it from your order details.');
          }
        }
      }

      await this.cartFacade.clear();

      return order;
    } catch {
      this._error.set('Unable to place your order. Please try again.');
      return null;
    } finally {
      this._placingOrder.set(false);
    }
  }

  private validate(): string[] {
    const errors: string[] = [];
    const summary = this.orderSummary();

    if (summary.items.length === 0) {
      errors.push('Your cart is empty.');
    }

    if (!this.addressesFacade.selectedAddressId()) {
      errors.push('Please select or add a delivery address.');
    }

    if (summary.items.some((item) => item.quantity < 1)) {
      errors.push('One or more items has an invalid quantity.');
    }

    return errors;
  }
}
