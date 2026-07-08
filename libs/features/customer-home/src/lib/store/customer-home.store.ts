import { Injectable, computed, inject, signal } from '@angular/core';
import type { CustomerHomeResponseDto } from '@patheya-express-frontend/api-sdk';
import { CustomerHomeService, type CustomerHomeQuery } from '../services/customer-home.service';

const EMPTY_HOME: CustomerHomeResponseDto = {
  banners: [],
  featuredRestaurants: [],
  nearbyRestaurants: [],
  popularRestaurants: [],
  recommendedRestaurants: [],
  cuisines: [],
};

@Injectable({ providedIn: 'root' })
export class CustomerHomeStore {
  private readonly customerHomeService = inject(CustomerHomeService);

  private readonly _home = signal<CustomerHomeResponseDto>(EMPTY_HOME);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _hasLocation = signal(false);

  readonly home = this._home.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasLocation = this._hasLocation.asReadonly();

  readonly isEmpty = computed(() => {
    const home = this._home();
    return (
      !this._loading() &&
      !this._error() &&
      home.featuredRestaurants.length === 0 &&
      home.nearbyRestaurants.length === 0 &&
      home.popularRestaurants.length === 0 &&
      home.recommendedRestaurants.length === 0
    );
  });

  async loadHome(query: CustomerHomeQuery = {}): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    this._hasLocation.set(query.lat !== undefined && query.lng !== undefined);

    try {
      this._home.set(await this.customerHomeService.getHome(query));
    } catch {
      this._error.set('Unable to load the home screen. Please try again.');
      this._home.set(EMPTY_HOME);
    } finally {
      this._loading.set(false);
    }
  }
}
