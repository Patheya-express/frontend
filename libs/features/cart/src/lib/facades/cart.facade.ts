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
  readonly pendingConflict = this.store.pendingConflict;

  restore(): Promise<void> {
    return this.store.restore();
  }

  addItem(request: AddToCartRequest): Promise<void> {
    return this.store.addItem(request);
  }

  confirmReplaceCart(): Promise<void> {
    return this.store.confirmReplaceCart();
  }

  cancelPendingAdd(): void {
    this.store.cancelPendingAdd();
  }

  increaseQuantity(menuItemId: string): Promise<void> {
    return this.store.increaseQuantity(menuItemId);
  }

  decreaseQuantity(menuItemId: string): Promise<void> {
    return this.store.decreaseQuantity(menuItemId);
  }

  removeItem(menuItemId: string): Promise<void> {
    return this.store.removeItem(menuItemId);
  }

  clear(): Promise<void> {
    return this.store.clear();
  }
}
