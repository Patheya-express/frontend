import { Injectable, inject } from '@angular/core';
import { RestaurantStore } from '../store/restaurant.store';
import type { RestaurantListQuery } from '../services/restaurant.service';

@Injectable({ providedIn: 'root' })
export class RestaurantFacade {
  private readonly store = inject(RestaurantStore);

  readonly restaurants = this.store.restaurants;
  readonly pagination = this.store.pagination;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly isEmpty = this.store.isEmpty;

  loadRestaurants(query: RestaurantListQuery = {}): Promise<void> {
    return this.store.loadRestaurants(query);
  }
}
