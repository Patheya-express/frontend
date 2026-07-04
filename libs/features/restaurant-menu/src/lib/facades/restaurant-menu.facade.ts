import { Injectable, inject } from '@angular/core';
import { RestaurantMenuStore } from '../store/restaurant-menu.store';

@Injectable({ providedIn: 'root' })
export class RestaurantMenuFacade {
  private readonly store = inject(RestaurantMenuStore);

  readonly restaurant = this.store.restaurant;
  readonly menu = this.store.menu;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly isEmpty = this.store.isEmpty;

  loadRestaurantMenu(restaurantId: string): Promise<void> {
    return this.store.loadRestaurantMenu(restaurantId);
  }
}
