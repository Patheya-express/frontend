import { Injectable, inject } from '@angular/core';
import { RestaurantMenuStore } from '../store/restaurant-menu.store';

@Injectable({ providedIn: 'root' })
export class RestaurantMenuFacade {
  private readonly store = inject(RestaurantMenuStore);

  readonly restaurant = this.store.restaurant;
  readonly menu = this.store.menu;
  readonly loading = this.store.loading;
  readonly menuLoading = this.store.menuLoading;
  readonly error = this.store.error;
  readonly isEmpty = this.store.isEmpty;
  readonly search = this.store.search;

  loadRestaurantMenu(restaurantId: string): Promise<void> {
    return this.store.loadRestaurantMenu(restaurantId);
  }

  searchMenu(query: string): Promise<void> {
    return this.store.searchMenu(query);
  }
}
