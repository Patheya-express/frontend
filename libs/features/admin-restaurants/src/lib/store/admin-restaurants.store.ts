import { Injectable, computed, inject, signal } from '@angular/core';
import type { RestaurantResponseDto } from '@patheya-express-frontend/api-sdk';
import { AdminRestaurantsService } from '../services/admin-restaurants.service';

export type RestaurantStatusFilter = RestaurantResponseDto['status'];

export interface AdminRestaurantsFilters {
  search: string;
  city: string;
  cuisine: string;
  status: RestaurantStatusFilter | null;
}

export interface AdminRestaurantsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminRestaurantsState {
  restaurants: RestaurantResponseDto[];
  pagination: AdminRestaurantsPagination;
  filters: AdminRestaurantsFilters;
  selectedRestaurant: RestaurantResponseDto | null;
}

const DEFAULT_PAGINATION: AdminRestaurantsPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
const DEFAULT_FILTERS: AdminRestaurantsFilters = { search: '', city: '', cuisine: '', status: null };

@Injectable({ providedIn: 'root' })
export class AdminRestaurantsStore {
  private readonly adminRestaurantsService = inject(AdminRestaurantsService);

  private readonly _restaurants = signal<RestaurantResponseDto[]>([]);
  private readonly _pagination = signal<AdminRestaurantsPagination>(DEFAULT_PAGINATION);
  private readonly _filters = signal<AdminRestaurantsFilters>(DEFAULT_FILTERS);
  private readonly _selectedRestaurant = signal<RestaurantResponseDto | null>(null);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _processingId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly processingId = this._processingId.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly state = computed<AdminRestaurantsState>(() => ({
    restaurants: this._restaurants(),
    pagination: this._pagination(),
    filters: this._filters(),
    selectedRestaurant: this._selectedRestaurant(),
  }));

  async loadRestaurants(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const filters = this._filters();
      const pagination = this._pagination();

      const response = await this.adminRestaurantsService.getRestaurants({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search || undefined,
        city: filters.city || undefined,
        cuisine: filters.cuisine || undefined,
        status: filters.status ?? undefined,
      });

      this._restaurants.set(response.items);
      this._pagination.set({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: response.totalPages,
      });
    } catch {
      this._error.set('Unable to load restaurants. Please try again.');
      this._restaurants.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  setSearch(search: string): void {
    this._filters.update((filters) => ({ ...filters, search }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadRestaurants();
  }

  setCityFilter(city: string): void {
    this._filters.update((filters) => ({ ...filters, city }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadRestaurants();
  }

  setCuisineFilter(cuisine: string): void {
    this._filters.update((filters) => ({ ...filters, cuisine }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadRestaurants();
  }

  setStatusFilter(status: RestaurantStatusFilter | null): void {
    this._filters.update((filters) => ({ ...filters, status }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadRestaurants();
  }

  setPage(page: number): void {
    this._pagination.update((pagination) => ({ ...pagination, page }));
    void this.loadRestaurants();
  }

  selectRestaurant(restaurant: RestaurantResponseDto | null): void {
    this._selectedRestaurant.set(restaurant);
  }

  approveRestaurant(restaurantId: string): Promise<void> {
    return this.transitionRestaurant(
      restaurantId,
      (restaurant) => ({ ...restaurant, status: 'APPROVED' }),
      (original) => this.adminRestaurantsService.approveRestaurant(original.id),
    );
  }

  rejectRestaurant(restaurantId: string): Promise<void> {
    return this.transitionRestaurant(
      restaurantId,
      (restaurant) => ({ ...restaurant, status: 'REJECTED' }),
      (original) => this.adminRestaurantsService.rejectRestaurant(original.id),
    );
  }

  suspendRestaurant(restaurantId: string): Promise<void> {
    return this.transitionRestaurant(
      restaurantId,
      (restaurant) => ({ ...restaurant, status: 'SUSPENDED' }),
      (original) => this.adminRestaurantsService.suspendRestaurant(original.id),
    );
  }

  restoreRestaurant(restaurantId: string): Promise<void> {
    return this.transitionRestaurant(
      restaurantId,
      (restaurant) => ({ ...restaurant, status: 'APPROVED' }),
      (original) => this.adminRestaurantsService.restoreRestaurant(original.id),
    );
  }

  dismissActionError(): void {
    this._actionError.set(null);
  }

  /**
   * The single path every restaurant status transition runs through — approve, reject,
   * suspend, and restore — mirroring AdminUsersStore's transitionUser: optimistically apply
   * the change, then reconcile with the server response, or roll back to the original on
   * failure. `processingId`/`actionError` are shared across all four transitions on purpose —
   * only one transition can be in flight for a given restaurant at a time.
   */
  private async transitionRestaurant(
    restaurantId: string,
    applyOptimistic: (restaurant: RestaurantResponseDto) => RestaurantResponseDto,
    action: (original: RestaurantResponseDto) => Promise<RestaurantResponseDto>,
  ): Promise<void> {
    const original = this._restaurants().find((restaurant) => restaurant.id === restaurantId);
    if (!original) {
      return;
    }

    this._processingId.set(restaurantId);
    this.replaceRestaurant(restaurantId, applyOptimistic(original));

    try {
      const updated = await action(original);
      this.replaceRestaurant(restaurantId, updated);

      if (this._selectedRestaurant()?.id === restaurantId) {
        this._selectedRestaurant.set(updated);
      }

      this._actionError.set(null);
    } catch {
      this.replaceRestaurant(restaurantId, original);
      this._actionError.set('Unable to update this restaurant. Please try again.');
    } finally {
      this._processingId.set(null);
    }
  }

  private replaceRestaurant(restaurantId: string, replacement: RestaurantResponseDto): void {
    this._restaurants.update((restaurants) =>
      restaurants.map((restaurant) => (restaurant.id === restaurantId ? replacement : restaurant)),
    );
  }
}
