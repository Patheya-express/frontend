import { Injectable, inject } from '@angular/core';
import type { CartItem } from '../models/cart-item.model';
import { CartStorageService } from '../storage/cart-storage.service';

/**
 * Local-storage-backed cart persistence. The backend does not expose Cart APIs today, so this
 * class owns the durable copy of the cart. Its async signature is deliberate: swapping this
 * implementation for a backend-synced one later requires no changes to CartStore, CartFacade,
 * or any component.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly storage = inject(CartStorageService);

  async load(): Promise<CartItem[]> {
    return this.storage.load();
  }

  async persist(items: CartItem[]): Promise<void> {
    this.storage.save(items);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }
}
