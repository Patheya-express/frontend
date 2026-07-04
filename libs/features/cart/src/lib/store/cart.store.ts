import { Injectable, computed, inject, signal } from '@angular/core';
import type { CartItem } from '../models/cart-item.model';
import { CartService } from '../services/cart.service';

export interface AddToCartRequest {
  menuItemId: string;
  name: string;
  unitPrice: number;
  restaurantId: string;
  restaurantName: string;
}

@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly cartService = inject(CartService);

  private readonly _items = signal<CartItem[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  /** Set when an add-to-cart request targets a different restaurant than the current cart; awaits user confirmation. */
  private readonly _pendingConflict = signal<AddToCartRequest | null>(null);

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly pendingConflict = this._pendingConflict.asReadonly();

  readonly subtotal = computed(() =>
    this._items().reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );
  readonly totalItems = computed(() => this._items().reduce((sum, item) => sum + item.quantity, 0));

  /** Hydrates cart state from persisted storage. Call once at app bootstrap. */
  async restore(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const items = await this.cartService.load();
      this._items.set(items);
    } catch {
      this._error.set('Unable to restore your cart.');
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Adds one unit of the requested item. If the cart already contains items from a different
   * restaurant, the request is held as a pending conflict instead of being applied — the cart
   * is scoped to a single restaurant, and mixing restaurants requires explicit confirmation to
   * clear the existing cart first (see confirmReplaceCart / cancelPendingAdd).
   */
  async addItem(request: AddToCartRequest): Promise<void> {
    const existingRestaurantId = this._items()[0]?.restaurantId;

    if (existingRestaurantId && existingRestaurantId !== request.restaurantId) {
      this._pendingConflict.set(request);
      return;
    }

    await this.upsertItem(request);
  }

  /** Clears the current cart and adds the item that triggered the pending restaurant conflict. */
  async confirmReplaceCart(): Promise<void> {
    const request = this._pendingConflict();
    if (!request) {
      return;
    }

    this._pendingConflict.set(null);
    this._items.set([]);
    await this.upsertItem(request);
  }

  /** Discards the pending add without changing the current cart. */
  cancelPendingAdd(): void {
    this._pendingConflict.set(null);
  }

  async increaseQuantity(menuItemId: string): Promise<void> {
    const items = this._items().map((item) =>
      item.menuItemId === menuItemId ? { ...item, quantity: item.quantity + 1 } : item,
    );
    await this.persistItems(items);
  }

  async decreaseQuantity(menuItemId: string): Promise<void> {
    const items = this._items()
      .map((item) => (item.menuItemId === menuItemId ? { ...item, quantity: item.quantity - 1 } : item))
      .filter((item) => item.quantity > 0);
    await this.persistItems(items);
  }

  async removeItem(menuItemId: string): Promise<void> {
    const items = this._items().filter((item) => item.menuItemId !== menuItemId);
    await this.persistItems(items);
  }

  async clear(): Promise<void> {
    this._items.set([]);
    this._error.set(null);
    await this.cartService.clear();
  }

  private async upsertItem(request: AddToCartRequest): Promise<void> {
    const items = this._items();
    const existing = items.find((item) => item.menuItemId === request.menuItemId);

    const nextItems = existing
      ? items.map((item) =>
          item.menuItemId === request.menuItemId ? { ...item, quantity: item.quantity + 1 } : item,
        )
      : [...items, { ...request, quantity: 1 }];

    await this.persistItems(nextItems);
  }

  private async persistItems(items: CartItem[]): Promise<void> {
    this._items.set(items);
    this._error.set(null);

    try {
      await this.cartService.persist(items);
    } catch {
      this._error.set('Unable to save your cart.');
    }
  }
}
