import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { CartResponseDto } from '@patheya-express-frontend/api-sdk';
import type { CartItem } from '../models/cart-item.model';
import { CartService, type AddCartItemRequest } from '../services/cart.service';

export interface AddToCartRequest extends AddCartItemRequest {
  /** Display-only — the target restaurant's name, shown in the conflict dialog if the cart must be replaced. */
  restaurantName: string;
}

function isConflict(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 409;
}

@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly cartService = inject(CartService);

  private readonly _cart = signal<CartResponseDto | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  /** Set when an add-to-cart request targets a different restaurant than the current cart; awaits user confirmation. */
  private readonly _pendingConflict = signal<AddToCartRequest | null>(null);

  readonly items = computed<CartItem[]>(() => this._cart()?.items ?? []);
  readonly restaurantId = computed(() => this._cart()?.restaurantId);
  readonly restaurantName = computed(() => this._cart()?.restaurantName);
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly pendingConflict = this._pendingConflict.asReadonly();

  readonly subtotal = computed(() => this._cart()?.subtotal ?? 0);
  readonly totalItems = computed(() => this._cart()?.totalItems ?? 0);

  /** Hydrates cart state from the backend. Call once at app bootstrap. */
  async restore(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const cart = await this.cartService.getCart();
      this._cart.set(cart);
    } catch {
      this._error.set('Unable to restore your cart.');
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Adds the requested item. If the cart already contains items from a different restaurant,
   * the server rejects with 409 and the request is held as a pending conflict instead of being
   * applied — the cart is scoped to a single restaurant, and mixing restaurants requires
   * explicit confirmation to clear the existing cart first (see confirmReplaceCart / cancelPendingAdd).
   */
  async addItem(request: AddToCartRequest): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const cart = await this.cartService.addItem(request, false);
      this._cart.set(cart);
    } catch (err) {
      if (isConflict(err)) {
        this._pendingConflict.set(request);
      } else {
        this._error.set('Unable to add item to cart.');
      }
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Adds an item and reports success/failure directly, instead of the pending-conflict-dialog
   * flow `addItem` uses — for bulk/programmatic add scenarios (e.g. reordering a past order)
   * where a per-item success signal is more useful than an interactive confirmation. Always
   * replaces a cross-restaurant cart rather than pausing for confirmation, since the caller
   * already made that call by initiating a bulk add.
   */
  async tryAddItem(request: AddToCartRequest): Promise<boolean> {
    try {
      const cart = await this.cartService.addItem(request, true);
      this._cart.set(cart);
      return true;
    } catch {
      return false;
    }
  }

  /** Clears the current cart and adds the item that triggered the pending restaurant conflict. */
  async confirmReplaceCart(): Promise<void> {
    const request = this._pendingConflict();
    if (!request) {
      return;
    }

    this._pendingConflict.set(null);
    this._loading.set(true);
    this._error.set(null);

    try {
      const cart = await this.cartService.addItem(request, true);
      this._cart.set(cart);
    } catch {
      this._error.set('Unable to add item to cart.');
    } finally {
      this._loading.set(false);
    }
  }

  /** Discards the pending add without changing the current cart. */
  cancelPendingAdd(): void {
    this._pendingConflict.set(null);
  }

  async updateQuantity(cartItemId: string, quantity: number): Promise<void> {
    if (quantity < 1) {
      await this.removeItem(cartItemId);
      return;
    }

    this._error.set(null);

    try {
      const cart = await this.cartService.updateQuantity(cartItemId, quantity);
      this._cart.set(cart);
    } catch {
      this._error.set('Unable to update this item.');
    }
  }

  async increaseQuantity(cartItemId: string): Promise<void> {
    const item = this.items().find((i) => i.id === cartItemId);
    if (!item) {
      return;
    }
    await this.updateQuantity(cartItemId, item.quantity + 1);
  }

  async decreaseQuantity(cartItemId: string): Promise<void> {
    const item = this.items().find((i) => i.id === cartItemId);
    if (!item) {
      return;
    }
    await this.updateQuantity(cartItemId, item.quantity - 1);
  }

  async removeItem(cartItemId: string): Promise<void> {
    this._error.set(null);

    try {
      const cart = await this.cartService.removeItem(cartItemId);
      this._cart.set(cart);
    } catch {
      this._error.set('Unable to remove this item.');
    }
  }

  async clear(): Promise<void> {
    this._error.set(null);

    try {
      const cart = await this.cartService.clear();
      this._cart.set(cart);
    } catch {
      this._error.set('Unable to clear your cart.');
    }
  }
}
