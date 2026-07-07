import { Injectable, inject } from '@angular/core';
import type { RestaurantResponseDto } from '@patheya-express-frontend/api-sdk';
import { AdminRestaurantsStore, type RestaurantStatusFilter } from '../store/admin-restaurants.store';

@Injectable({ providedIn: 'root' })
export class AdminRestaurantsFacade {
  private readonly store = inject(AdminRestaurantsStore);

  readonly state = this.store.state;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly processingId = this.store.processingId;
  readonly actionError = this.store.actionError;

  /** Loads the first page of restaurants. Call once on page init. */
  initialize(): Promise<void> {
    return this.store.loadRestaurants();
  }

  refresh(): Promise<void> {
    return this.store.loadRestaurants();
  }

  setSearch(search: string): void {
    this.store.setSearch(search);
  }

  setCityFilter(city: string): void {
    this.store.setCityFilter(city);
  }

  setCuisineFilter(cuisine: string): void {
    this.store.setCuisineFilter(cuisine);
  }

  setStatusFilter(status: RestaurantStatusFilter | null): void {
    this.store.setStatusFilter(status);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  selectRestaurant(restaurant: RestaurantResponseDto | null): void {
    this.store.selectRestaurant(restaurant);
  }

  approveRestaurant(restaurantId: string): Promise<void> {
    return this.store.approveRestaurant(restaurantId);
  }

  rejectRestaurant(restaurantId: string): Promise<void> {
    return this.store.rejectRestaurant(restaurantId);
  }

  suspendRestaurant(restaurantId: string): Promise<void> {
    return this.store.suspendRestaurant(restaurantId);
  }

  restoreRestaurant(restaurantId: string): Promise<void> {
    return this.store.restoreRestaurant(restaurantId);
  }

  dismissActionError(): void {
    this.store.dismissActionError();
  }
}
