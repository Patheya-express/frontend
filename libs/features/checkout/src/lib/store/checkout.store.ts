import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { CreateOrderDto, OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { CartFacade, type CartItem } from '@patheya-express-frontend/cart';
import { AddressesFacade } from '@patheya-express-frontend/addresses';
import { PaymentsCheckoutService } from '@patheya-express-frontend/core';
import { CustomerWalletFacade } from '@patheya-express-frontend/customer-wallet';
import { CouponFacade } from '@patheya-express-frontend/coupons';
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
  discountAmount: number;
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
  private readonly couponFacade = inject(CouponFacade);

  private readonly _paymentMode = signal<PaymentMode>('ONLINE');
  private readonly _useWallet = signal(false);
  private readonly _placingOrder = signal(false);
  private readonly _validationErrors = signal<string[]>([]);
  private readonly _error = signal<string | null>(null);

  // One UUID per checkout attempt (order idempotency — Sprint 1.2). Lazily created on the first
  // placeOrder() call and reused verbatim across retries of that SAME attempt (double-click,
  // network timeout, resubmit) so the backend can recognize and collapse them into one order.
  // Only cleared back to null after a successful placement, so the next order gets a fresh key.
  private _idempotencyKey: string | null = null;

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

    const restaurantId = this.cartFacade.restaurantId() ?? null;
    const restaurantName = this.cartFacade.restaurantName() ?? null;
    const totalItems = this.cartFacade.totalItems();

    // A coupon's pricing preview is server-computed (PricingEngineService) and authoritative once
    // applied — this only ever substitutes those already-computed numbers in, it never re-derives
    // them here.
    const coupon = this.couponFacade.appliedCoupon();
    const pricing = this.couponFacade.pricing();

    if (coupon && pricing) {
      return {
        restaurantId,
        restaurantName,
        items,
        subtotal: pricing.subtotal,
        totalItems,
        deliveryFee: pricing.deliveryFee,
        taxAmount: pricing.taxAmount,
        discountAmount: pricing.discountAmount,
        totalAmount: pricing.totalAmount,
      };
    }

    return {
      restaurantId,
      restaurantName,
      items,
      subtotal,
      totalItems,
      deliveryFee,
      taxAmount,
      discountAmount: 0,
      totalAmount: subtotal + deliveryFee + taxAmount,
    };
  });

  constructor() {
    // Keeps an applied coupon's discount accurate as the cart changes (quantity/item edits) —
    // drops the coupon with a clear reason if it's no longer eligible (e.g. subtotal fell below
    // minOrderAmount) rather than silently showing a stale discount.
    effect(() => {
      const restaurantId = this.cartFacade.restaurantId();
      const subtotal = this.cartFacade.subtotal();
      const coupon = this.couponFacade.appliedCoupon();

      if (coupon && restaurantId) {
        void this.couponFacade.refresh(restaurantId, subtotal);
      }
    });

    inject(LogoutCleanupRegistry).register(() => this.reset());
  }

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
    // Synchronous re-entrancy guard — closes the timing gap where two rapid-fire clicks can both
    // read the button's `[loading]` input as false before Angular's change detection has flushed
    // the `_placingOrder` write from the first click through to it (see ButtonBase.handleClick,
    // which only guards on its OWN input signal). This check runs before anything async, so a
    // genuine double-click can never get two calls past this point.
    if (this._placingOrder()) {
      return null;
    }

    const errors = this.validate();
    this._validationErrors.set(errors);

    if (errors.length > 0) {
      return null;
    }

    const summary = this.orderSummary();
    const addressId = this.addressesFacade.selectedAddressId();
    const coupon = this.couponFacade.appliedCoupon();
    this._placingOrder.set(true);
    this._error.set(null);

    // Order idempotency (Sprint 1.2): one UUID per checkout attempt, created on first use and
    // reused verbatim across retries until this attempt succeeds (see field doc comment above).
    this._idempotencyKey ??= crypto.randomUUID();

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
      couponCode: coupon?.code,
      idempotencyKey: this._idempotencyKey,
    };

    try {
      const order = await this.checkoutService.placeOrder(dto);

      // The order now exists (whether freshly created or replayed by the backend for a retried
      // key) — this checkout attempt is over. The next placeOrder() call is a NEW attempt (e.g.
      // ordering again after this one), so it must get a fresh key rather than silently reusing
      // this one and being treated as a replay of an already-completed order.
      this._idempotencyKey = null;

      if (coupon) {
        this.couponFacade.rememberCodeForOrder(order.id, coupon.code);
        this.couponFacade.remove();
      }

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

  /** Also drops the pending idempotency key — it must never survive into a different customer's
   *  (or even the same customer's next, unrelated) checkout attempt on this device. */
  reset(): void {
    this._paymentMode.set('ONLINE');
    this._useWallet.set(false);
    this._placingOrder.set(false);
    this._validationErrors.set([]);
    this._error.set(null);
    this._idempotencyKey = null;
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
