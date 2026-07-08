import { Injectable, inject } from '@angular/core';
import { FavoritesStore } from '../store/favorites.store';

@Injectable({ providedIn: 'root' })
export class FavoritesFacade {
  private readonly store = inject(FavoritesStore);

  readonly favoritedRestaurantIds = this.store.favoritedRestaurantIds;
  readonly favoritedMenuItemIds = this.store.favoritedMenuItemIds;

  readonly restaurants = this.store.restaurants;
  readonly restaurantsTotal = this.store.restaurantsTotal;
  readonly restaurantsPage = this.store.restaurantsPage;
  readonly restaurantsTotalPages = this.store.restaurantsTotalPages;
  readonly restaurantsLoading = this.store.restaurantsLoading;
  readonly restaurantsError = this.store.restaurantsError;

  readonly menuItems = this.store.menuItems;
  readonly menuItemsTotal = this.store.menuItemsTotal;
  readonly menuItemsPage = this.store.menuItemsPage;
  readonly menuItemsTotalPages = this.store.menuItemsTotalPages;
  readonly menuItemsLoading = this.store.menuItemsLoading;
  readonly menuItemsError = this.store.menuItemsError;

  isRestaurantFavorited(restaurantId: string): boolean {
    return this.store.isRestaurantFavorited(restaurantId);
  }

  isMenuItemFavorited(menuItemId: string): boolean {
    return this.store.isMenuItemFavorited(menuItemId);
  }

  checkRestaurantFavorites(restaurantIds: string[]): Promise<void> {
    return this.store.checkRestaurantFavorites(restaurantIds);
  }

  checkMenuItemFavorites(menuItemIds: string[]): Promise<void> {
    return this.store.checkMenuItemFavorites(menuItemIds);
  }

  toggleRestaurantFavorite(restaurantId: string): Promise<void> {
    return this.store.toggleRestaurantFavorite(restaurantId);
  }

  toggleMenuItemFavorite(menuItemId: string): Promise<void> {
    return this.store.toggleMenuItemFavorite(menuItemId);
  }

  loadFavoriteRestaurants(page?: number): Promise<void> {
    return this.store.loadFavoriteRestaurants(page);
  }

  loadFavoriteMenuItems(page?: number): Promise<void> {
    return this.store.loadFavoriteMenuItems(page);
  }
}
