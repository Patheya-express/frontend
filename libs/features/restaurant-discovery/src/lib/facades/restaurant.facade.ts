import { Injectable, inject } from '@angular/core';
import { RestaurantStore, type RestaurantFilters } from '../store/restaurant.store';

@Injectable({ providedIn: 'root' })
export class RestaurantFacade {
  private readonly store = inject(RestaurantStore);

  readonly restaurants = this.store.restaurants;
  readonly pagination = this.store.pagination;
  readonly filters = this.store.filters;
  readonly cuisines = this.store.cuisines;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly isEmpty = this.store.isEmpty;

  /** Loads the first page of restaurants and the cuisine filter list. Call once on page init. */
  async initialize(): Promise<void> {
    await Promise.all([this.store.refresh(), this.store.loadCuisines()]);
  }

  retry(): Promise<void> {
    return this.store.refresh();
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

  setOpenNowFilter(openNow: boolean): void {
    this.store.setOpenNowFilter(openNow);
  }

  setVegFilter(veg: boolean): void {
    this.store.setVegFilter(veg);
  }

  setVeganFilter(vegan: boolean): void {
    this.store.setVeganFilter(vegan);
  }

  setOffersFilter(offers: boolean): void {
    this.store.setOffersFilter(offers);
  }

  setMinRating(minRating: number | undefined): void {
    this.store.setMinRating(minRating);
  }

  setMaxDeliveryTimeMinutes(maxDeliveryTimeMinutes: number | undefined): void {
    this.store.setMaxDeliveryTimeMinutes(maxDeliveryTimeMinutes);
  }

  setSort(sortBy: RestaurantFilters['sortBy'], sortOrder: RestaurantFilters['sortOrder']): void {
    this.store.setSort(sortBy, sortOrder);
  }

  clearFilters(): void {
    this.store.clearFilters();
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }
}
