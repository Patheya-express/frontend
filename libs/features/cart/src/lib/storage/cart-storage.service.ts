import { Injectable } from '@angular/core';
import type { CartItem } from '../models/cart-item.model';

const CART_ITEMS_KEY = 'patheya.cart.items';

@Injectable({ providedIn: 'root' })
export class CartStorageService {
  load(): CartItem[] {
    const raw = localStorage.getItem(CART_ITEMS_KEY);

    if (!raw) {
      return [];
    }

    try {
      const items = JSON.parse(raw) as CartItem[];
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }

  save(items: CartItem[]): void {
    localStorage.setItem(CART_ITEMS_KEY, JSON.stringify(items));
  }

  clear(): void {
    localStorage.removeItem(CART_ITEMS_KEY);
  }
}
