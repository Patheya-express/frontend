import { Injectable, inject, signal } from '@angular/core';
import type {
  MenuItemResponseDto,
  RestaurantSummaryDto,
} from '@patheya-express-frontend/api-sdk';
import { FavoritesService } from '../services/favorites.service';

const PAGE_SIZE = 20;

@Injectable({ providedIn: 'root' })
export class FavoritesStore {
  private readonly favoritesService = inject(FavoritesService);

  private readonly _favoritedRestaurantIds = signal<ReadonlySet<string>>(new Set());
  private readonly _favoritedMenuItemIds = signal<ReadonlySet<string>>(new Set());

  private readonly _restaurants = signal<RestaurantSummaryDto[]>([]);
  private readonly _restaurantsTotal = signal(0);
  private readonly _restaurantsPage = signal(1);
  private readonly _restaurantsLoading = signal(false);
  private readonly _restaurantsError = signal<string | null>(null);

  private readonly _menuItems = signal<MenuItemResponseDto[]>([]);
  private readonly _menuItemsTotal = signal(0);
  private readonly _menuItemsPage = signal(1);
  private readonly _menuItemsLoading = signal(false);
  private readonly _menuItemsError = signal<string | null>(null);

  readonly favoritedRestaurantIds = this._favoritedRestaurantIds.asReadonly();
  readonly favoritedMenuItemIds = this._favoritedMenuItemIds.asReadonly();

  readonly restaurants = this._restaurants.asReadonly();
  readonly restaurantsTotal = this._restaurantsTotal.asReadonly();
  readonly restaurantsPage = this._restaurantsPage.asReadonly();
  readonly restaurantsTotalPages = () => Math.ceil(this._restaurantsTotal() / PAGE_SIZE) || 1;
  readonly restaurantsLoading = this._restaurantsLoading.asReadonly();
  readonly restaurantsError = this._restaurantsError.asReadonly();

  readonly menuItems = this._menuItems.asReadonly();
  readonly menuItemsTotal = this._menuItemsTotal.asReadonly();
  readonly menuItemsPage = this._menuItemsPage.asReadonly();
  readonly menuItemsTotalPages = () => Math.ceil(this._menuItemsTotal() / PAGE_SIZE) || 1;
  readonly menuItemsLoading = this._menuItemsLoading.asReadonly();
  readonly menuItemsError = this._menuItemsError.asReadonly();

  isRestaurantFavorited(restaurantId: string): boolean {
    return this._favoritedRestaurantIds().has(restaurantId);
  }

  isMenuItemFavorited(menuItemId: string): boolean {
    return this._favoritedMenuItemIds().has(menuItemId);
  }

  /** Single bulk request for a whole page of cards — never one favorite-status request per card. */
  async checkRestaurantFavorites(restaurantIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(restaurantIds)];
    if (uniqueIds.length === 0) {
      return;
    }

    const statuses = await this.favoritesService.getRestaurantFavoriteStatus(uniqueIds);
    this._favoritedRestaurantIds.update((current) => {
      const next = new Set(current);
      for (const { id, isFavorited } of statuses) {
        if (isFavorited) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }

  async checkMenuItemFavorites(menuItemIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(menuItemIds)];
    if (uniqueIds.length === 0) {
      return;
    }

    const statuses = await this.favoritesService.getMenuItemFavoriteStatus(uniqueIds);
    this._favoritedMenuItemIds.update((current) => {
      const next = new Set(current);
      for (const { id, isFavorited } of statuses) {
        if (isFavorited) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }

  /** Optimistic toggle: flips immediately, reverts if the request fails. */
  async toggleRestaurantFavorite(restaurantId: string): Promise<void> {
    const wasFavorited = this.isRestaurantFavorited(restaurantId);
    this.setRestaurantFavorited(restaurantId, !wasFavorited);

    try {
      if (wasFavorited) {
        await this.favoritesService.removeRestaurantFavorite(restaurantId);
      } else {
        await this.favoritesService.addRestaurantFavorite(restaurantId);
      }
    } catch {
      this.setRestaurantFavorited(restaurantId, wasFavorited);
    }
  }

  async toggleMenuItemFavorite(menuItemId: string): Promise<void> {
    const wasFavorited = this.isMenuItemFavorited(menuItemId);
    this.setMenuItemFavorited(menuItemId, !wasFavorited);

    try {
      if (wasFavorited) {
        await this.favoritesService.removeMenuItemFavorite(menuItemId);
      } else {
        await this.favoritesService.addMenuItemFavorite(menuItemId);
      }
    } catch {
      this.setMenuItemFavorited(menuItemId, wasFavorited);
    }
  }

  async loadFavoriteRestaurants(page = 1): Promise<void> {
    this._restaurantsLoading.set(true);
    this._restaurantsError.set(null);

    try {
      const result = await this.favoritesService.getFavoriteRestaurants(page, PAGE_SIZE);
      this._restaurants.set(result.items);
      this._restaurantsTotal.set(result.total);
      this._restaurantsPage.set(page);

      this._favoritedRestaurantIds.update((current) => {
        const next = new Set(current);
        for (const restaurant of result.items) {
          next.add(restaurant.id);
        }
        return next;
      });
    } catch {
      this._restaurantsError.set('Unable to load your favorite restaurants. Please try again.');
    } finally {
      this._restaurantsLoading.set(false);
    }
  }

  async loadFavoriteMenuItems(page = 1): Promise<void> {
    this._menuItemsLoading.set(true);
    this._menuItemsError.set(null);

    try {
      const result = await this.favoritesService.getFavoriteMenuItems(page, PAGE_SIZE);
      this._menuItems.set(result.items);
      this._menuItemsTotal.set(result.total);
      this._menuItemsPage.set(page);

      this._favoritedMenuItemIds.update((current) => {
        const next = new Set(current);
        for (const item of result.items) {
          next.add(item.id);
        }
        return next;
      });
    } catch {
      this._menuItemsError.set('Unable to load your favorite dishes. Please try again.');
    } finally {
      this._menuItemsLoading.set(false);
    }
  }

  private setRestaurantFavorited(restaurantId: string, favorited: boolean): void {
    this._favoritedRestaurantIds.update((current) => {
      const next = new Set(current);
      if (favorited) {
        next.add(restaurantId);
      } else {
        next.delete(restaurantId);
      }
      return next;
    });

    if (!favorited) {
      this._restaurants.update((items) => items.filter((r) => r.id !== restaurantId));
    }
  }

  private setMenuItemFavorited(menuItemId: string, favorited: boolean): void {
    this._favoritedMenuItemIds.update((current) => {
      const next = new Set(current);
      if (favorited) {
        next.add(menuItemId);
      } else {
        next.delete(menuItemId);
      }
      return next;
    });

    if (!favorited) {
      this._menuItems.update((items) => items.filter((i) => i.id !== menuItemId));
    }
  }
}
