import { Injectable, computed, inject, signal } from '@angular/core';
import type { MenuCategoryResponseDto, RestaurantResponseDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantMenuService } from '../services/restaurant-menu.service';

@Injectable({ providedIn: 'root' })
export class RestaurantMenuStore {
  private readonly restaurantMenuService = inject(RestaurantMenuService);

  private readonly _restaurant = signal<RestaurantResponseDto | null>(null);
  private readonly _menu = signal<MenuCategoryResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _menuLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _search = signal('');

  private restaurantId = '';

  readonly restaurant = this._restaurant.asReadonly();
  readonly menu = this._menu.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly menuLoading = this._menuLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly search = this._search.asReadonly();

  readonly isEmpty = computed(
    () => !this._loading() && !this._error() && this._restaurant() !== null && this._menu().length === 0,
  );

  async loadRestaurantMenu(restaurantId: string): Promise<void> {
    this.restaurantId = restaurantId;
    this._loading.set(true);
    this._error.set(null);

    try {
      const [restaurant, menu] = await Promise.all([
        this.restaurantMenuService.getRestaurant(restaurantId),
        this.restaurantMenuService.getMenu(restaurantId),
      ]);

      this._restaurant.set(restaurant);
      this._menu.set(menu);
    } catch {
      this._error.set('Unable to load this restaurant. Please try again.');
      this._restaurant.set(null);
      this._menu.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  /** Re-fetches just the menu with the given search term — the restaurant itself doesn't change. */
  async searchMenu(query: string): Promise<void> {
    this._search.set(query);

    if (!this.restaurantId) {
      return;
    }

    this._menuLoading.set(true);

    try {
      const menu = await this.restaurantMenuService.getMenu(this.restaurantId, query.trim() || undefined);
      this._menu.set(menu);
    } catch {
      // A failed search shouldn't blank out the previously loaded menu.
    } finally {
      this._menuLoading.set(false);
    }
  }
}
