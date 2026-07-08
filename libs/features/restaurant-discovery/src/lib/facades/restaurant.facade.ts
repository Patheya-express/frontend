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

  setCuisineFilter(cuisine: string): void {
    this.store.setCuisineFilter(cuisine);
  }

  setOpenNowFilter(openNow: boolean): void {
    this.store.setOpenNowFilter(openNow);
  }

  setSort(sortBy: RestaurantFilters['sortBy'], sortOrder: RestaurantFilters['sortOrder']): void {
    this.store.setSort(sortBy, sortOrder);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }
}
