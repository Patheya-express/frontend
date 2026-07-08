import { Injectable, inject } from '@angular/core';
import {
  CartService as CartApiService,
  type AddCartItemDto,
  type CartResponseDto,
} from '@patheya-express-frontend/api-sdk';

// The API gateway wraps every response in a { success, timestamp, data } envelope via a
// global interceptor that Swagger/the generated SDK types do not account for.
interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

export interface AddCartItemRequest {
  menuItemId: string;
  variantId?: string;
  addonOptionIds?: string[];
  quantity?: number;
  specialInstructions?: string;
}

/** Thin wrapper around the backend Cart API — the server is the sole source of truth for cart state. */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly cartApi = inject(CartApiService);

  async getCart(): Promise<CartResponseDto> {
    return unwrap(await this.cartApi.cartControllerGetCart());
  }

  async addItem(request: AddCartItemRequest, replaceExisting: boolean): Promise<CartResponseDto> {
    const body: AddCartItemDto = {
      menuItemId: request.menuItemId,
      variantId: request.variantId,
      addonOptionIds: request.addonOptionIds,
      quantity: request.quantity ?? 1,
      specialInstructions: request.specialInstructions,
      replaceExisting,
    };

    return unwrap(await this.cartApi.cartControllerAddItem({ body }));
  }

  async updateQuantity(itemId: string, quantity: number): Promise<CartResponseDto> {
    return unwrap(await this.cartApi.cartControllerUpdateItem({ itemId, body: { quantity } }));
  }

  async removeItem(itemId: string): Promise<CartResponseDto> {
    return unwrap(await this.cartApi.cartControllerRemoveItem({ itemId }));
  }

  async clear(): Promise<CartResponseDto> {
    return unwrap(await this.cartApi.cartControllerClearCart());
  }
}
