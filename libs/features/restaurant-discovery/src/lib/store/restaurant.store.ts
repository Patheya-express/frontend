import { Injectable, computed, inject, signal } from '@angular/core';
import type { RestaurantResponseDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantService, type RestaurantListQuery } from '../services/restaurant.service';

export interface RestaurantPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const INITIAL_PAGINATION: RestaurantPagination = {
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
};

@Injectable({ providedIn: 'root' })
export class RestaurantStore {
  private readonly restaurantService = inject(RestaurantService);

  private readonly _restaurants = signal<RestaurantResponseDto[]>([]);
  private readonly _pagination = signal<RestaurantPagination>(INITIAL_PAGINATION);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly restaurants = this._restaurants.asReadonly();
  readonly pagination = this._pagination.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isEmpty = computed(
    () => !this._loading() && !this._error() && this._restaurants().length === 0,
  );

  async loadRestaurants(query: RestaurantListQuery = {}): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await this.restaurantService.listRestaurants(query);

      this._restaurants.set(response.items);
      this._pagination.set({
        total: response.total,
        page: response.page,
        limit: response.limit,
        totalPages: response.totalPages,
      });
    } catch {
      this._error.set('Unable to load restaurants. Please try again.');
      this._restaurants.set([]);
    } finally {
      this._loading.set(false);
    }
  }
}
