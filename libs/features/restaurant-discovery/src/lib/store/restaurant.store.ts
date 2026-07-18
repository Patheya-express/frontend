import { Injectable, computed, inject, signal } from '@angular/core';
import type { CuisineResponseDto, RestaurantSummaryDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantService, type RestaurantListQuery, type RestaurantSortBy } from '../services/restaurant.service';

export interface RestaurantPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RestaurantFilters {
  search: string;
  city: string;
  cuisine: string;
  openNow: boolean;
  veg: boolean;
  vegan: boolean;
  offers: boolean;
  minRating: number | undefined;
  maxDeliveryTimeMinutes: number | undefined;
  sortBy: RestaurantSortBy;
  sortOrder: 'asc' | 'desc';
}

const INITIAL_PAGINATION: RestaurantPagination = {
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
};

const INITIAL_FILTERS: RestaurantFilters = {
  search: '',
  city: '',
  cuisine: '',
  openNow: false,
  veg: false,
  vegan: false,
  offers: false,
  minRating: undefined,
  maxDeliveryTimeMinutes: undefined,
  sortBy: 'name',
  sortOrder: 'asc',
};

@Injectable({ providedIn: 'root' })
export class RestaurantStore {
  private readonly restaurantService = inject(RestaurantService);

  private readonly _restaurants = signal<RestaurantSummaryDto[]>([]);
  private readonly _pagination = signal<RestaurantPagination>(INITIAL_PAGINATION);
  private readonly _filters = signal<RestaurantFilters>(INITIAL_FILTERS);
  private readonly _cuisines = signal<CuisineResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly restaurants = this._restaurants.asReadonly();
  readonly pagination = this._pagination.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly cuisines = this._cuisines.asReadonly();
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

  async loadCuisines(): Promise<void> {
    try {
      this._cuisines.set(await this.restaurantService.listCuisines());
    } catch {
      this._cuisines.set([]);
    }
  }

/** Reloads using the current filters/pagination signals — the single path every mutator and retry() goes through. */
  refresh(): Promise<void> {
    const filters = this._filters();
    const pagination = this._pagination();

    return this.loadRestaurants({
      page: pagination.page,
      limit: pagination.limit,
      search: filters.search || undefined,
      city: filters.city || undefined,
      cuisine: filters.cuisine || undefined,
      openNow: filters.openNow || undefined,
      veg: filters.veg || undefined,
      vegan: filters.vegan || undefined,
      offers: filters.offers || undefined,
      minRating: filters.minRating,
      maxDeliveryTimeMinutes: filters.maxDeliveryTimeMinutes,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    });
  }

  setSearch(search: string): void {
    this._filters.update((filters) => ({ ...filters, search }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.refresh();
  }

  setCityFilter(city: string): void {
    this._filters.update((filters) => ({ ...filters, city }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.refresh();
  }

  setCuisineFilter(cuisine: string): void {
    this._filters.update((filters) => ({ ...filters, cuisine }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.refresh();
  }

  setOpenNowFilter(openNow: boolean): void {
    this._filters.update((filters) => ({ ...filters, openNow }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.refresh();
  }

  setVegFilter(veg: boolean): void {
    this._filters.update((filters) => ({ ...filters, veg }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.refresh();
  }

  setVeganFilter(vegan: boolean): void {
    this._filters.update((filters) => ({ ...filters, vegan }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.refresh();
  }

  setOffersFilter(offers: boolean): void {
    this._filters.update((filters) => ({ ...filters, offers }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.refresh();
  }

  setMinRating(minRating: number | undefined): void {
    this._filters.update((filters) => ({ ...filters, minRating }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.refresh();
  }

  setMaxDeliveryTimeMinutes(maxDeliveryTimeMinutes: number | undefined): void {
    this._filters.update((filters) => ({ ...filters, maxDeliveryTimeMinutes }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.refresh();
  }

  setSort(sortBy: RestaurantFilters['sortBy'], sortOrder: RestaurantFilters['sortOrder']): void {
    this._filters.update((filters) => ({ ...filters, sortBy, sortOrder }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.refresh();
  }

  clearFilters(): void {
    this._filters.set(INITIAL_FILTERS);
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.refresh();
  }

  setPage(page: number): void {
    this._pagination.update((pagination) => ({ ...pagination, page }));
    void this.refresh();
  }
}
