import { Injectable, computed, inject, signal } from '@angular/core';
import type { MenuCategoryResponseDto, RestaurantResponseDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantMenuService } from '../services/restaurant-menu.service';

@Injectable({ providedIn: 'root' })
export class RestaurantMenuStore {
  private readonly restaurantMenuService = inject(RestaurantMenuService);

  private readonly _restaurant = signal<RestaurantResponseDto | null>(null);
  private readonly _menu = signal<MenuCategoryResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly restaurant = this._restaurant.asReadonly();
  readonly menu = this._menu.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isEmpty = computed(
    () => !this._loading() && !this._error() && this._restaurant() !== null && this._menu().length === 0,
  );

  async loadRestaurantMenu(restaurantId: string): Promise<void> {
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
}
