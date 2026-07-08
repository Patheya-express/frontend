import { Injectable, inject } from '@angular/core';
import {
  FavoritesService as FavoritesSdkService,
  type FavoriteStatusItemDto,
  type FavoriteToggleResponseDto,
  type PaginatedFavoriteMenuItemsResponseDto,
  type PaginatedRestaurantSummariesResponseDto,
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

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly sdk = inject(FavoritesSdkService);

  async getFavoriteRestaurants(page: number, limit: number): Promise<PaginatedRestaurantSummariesResponseDto> {
    const response = await this.sdk.favoritesControllerGetFavoriteRestaurants({ page, limit });
    return unwrap(response);
  }

  async getFavoriteMenuItems(page: number, limit: number): Promise<PaginatedFavoriteMenuItemsResponseDto> {
    const response = await this.sdk.favoritesControllerGetFavoriteMenuItems({ page, limit });
    return unwrap(response);
  }

  async getRestaurantFavoriteStatus(ids: string[]): Promise<FavoriteStatusItemDto[]> {
    if (ids.length === 0) {
      return [];
    }
    const response = await this.sdk.favoritesControllerGetRestaurantFavoriteStatus({ ids: ids.join(',') });
    return unwrap(response);
  }

  async getMenuItemFavoriteStatus(ids: string[]): Promise<FavoriteStatusItemDto[]> {
    if (ids.length === 0) {
      return [];
    }
    const response = await this.sdk.favoritesControllerGetMenuItemFavoriteStatus({ ids: ids.join(',') });
    return unwrap(response);
  }

  async addRestaurantFavorite(restaurantId: string): Promise<FavoriteToggleResponseDto> {
    const response = await this.sdk.favoritesControllerAddRestaurantFavorite({ restaurantId });
    return unwrap(response);
  }

  async removeRestaurantFavorite(restaurantId: string): Promise<FavoriteToggleResponseDto> {
    const response = await this.sdk.favoritesControllerRemoveRestaurantFavorite({ restaurantId });
    return unwrap(response);
  }

  async addMenuItemFavorite(menuItemId: string): Promise<FavoriteToggleResponseDto> {
    const response = await this.sdk.favoritesControllerAddMenuItemFavorite({ menuItemId });
    return unwrap(response);
  }

  async removeMenuItemFavorite(menuItemId: string): Promise<FavoriteToggleResponseDto> {
    const response = await this.sdk.favoritesControllerRemoveMenuItemFavorite({ menuItemId });
    return unwrap(response);
  }
}
