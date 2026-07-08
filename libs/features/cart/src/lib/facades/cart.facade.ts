import { Injectable, inject } from '@angular/core';
import { CartStore, type AddToCartRequest } from '../store/cart.store';

@Injectable({ providedIn: 'root' })
export class CartFacade {
  private readonly store = inject(CartStore);

  readonly items = this.store.items;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly subtotal = this.store.subtotal;
  readonly totalItems = this.store.totalItems;
  readonly restaurantId = this.store.restaurantId;
  readonly restaurantName = this.store.restaurantName;
  readonly pendingConflict = this.store.pendingConflict;

  restore(): Promise<void> {
    return this.store.restore();
  }

  addItem(request: AddToCartRequest): Promise<void> {
    return this.store.addItem(request);
  }

  tryAddItem(request: AddToCartRequest): Promise<boolean> {
    return this.store.tryAddItem(request);
  }

  confirmReplaceCart(): Promise<void> {
    return this.store.confirmReplaceCart();
  }

  cancelPendingAdd(): void {
    this.store.cancelPendingAdd();
  }

  increaseQuantity(cartItemId: string): Promise<void> {
    return this.store.increaseQuantity(cartItemId);
  }

  decreaseQuantity(cartItemId: string): Promise<void> {
    return this.store.decreaseQuantity(cartItemId);
  }

  removeItem(cartItemId: string): Promise<void> {
    return this.store.removeItem(cartItemId);
  }

  clear(): Promise<void> {
    return this.store.clear();
  }
}
