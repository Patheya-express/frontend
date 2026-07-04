import { Injectable, computed, inject, signal } from '@angular/core';
import type { CreateOrderDto, OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { CartFacade, type CartItem } from '@patheya-express-frontend/cart';
import { CheckoutService } from '../services/checkout.service';

export interface OrderSummary {
  restaurantId: string | null;
  restaurantName: string | null;
  items: CartItem[];
  subtotal: number;
  totalItems: number;
}

@Injectable({ providedIn: 'root' })
export class CheckoutStore {
  private readonly cartFacade = inject(CartFacade);
  private readonly checkoutService = inject(CheckoutService);

  private readonly _address = signal('');
  private readonly _placingOrder = signal(false);
  private readonly _validationErrors = signal<string[]>([]);
  private readonly _error = signal<string | null>(null);

  readonly address = this._address.asReadonly();
  readonly placingOrder = this._placingOrder.asReadonly();
  readonly validationErrors = this._validationErrors.asReadonly();
  readonly error = this._error.asReadonly();

  readonly orderSummary = computed<OrderSummary>(() => {
    const items = this.cartFacade.items();
    return {
      restaurantId: items[0]?.restaurantId ?? null,
      restaurantName: items[0]?.restaurantName ?? null,
      items,
      subtotal: this.cartFacade.subtotal(),
      totalItems: this.cartFacade.totalItems(),
    };
  });

  setAddress(address: string): void {
    this._address.set(address);
  }

  /** Validates and submits the current cart as an order. Returns the created order, or null if invalid/failed. */
  async placeOrder(): Promise<OrderResponseDto | null> {
    const errors = this.validate();
    this._validationErrors.set(errors);

    if (errors.length > 0) {
      return null;
    }

    const summary = this.orderSummary();
    this._placingOrder.set(true);
    this._error.set(null);

    const dto: CreateOrderDto = {
      restaurantId: summary.restaurantId as string,
      deliveryAddress: this._address().trim(),
      items: summary.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      })),
    };

    try {
      const order = await this.checkoutService.placeOrder(dto);
      await this.cartFacade.clear();
      this._address.set('');
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

    if (!this._address().trim()) {
      errors.push('A delivery address is required.');
    }

    if (summary.items.some((item) => item.quantity < 1)) {
      errors.push('One or more items has an invalid quantity.');
    }

    return errors;
  }
}
