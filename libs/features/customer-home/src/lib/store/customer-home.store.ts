import { Injectable, computed, inject, signal } from '@angular/core';
import type { CustomerHomeResponseDto, RestaurantSummaryDto } from '@patheya-express-frontend/api-sdk';
import { NetworkStatusService } from '@patheya-express-frontend/ui';
import { CustomerHomeService, type CustomerHomeQuery } from '../services/customer-home.service';

const EMPTY_HOME: CustomerHomeResponseDto = {
  banners: [],
  featuredRestaurants: [],
  nearbyRestaurants: [],
  popularRestaurants: [],
  recommendedRestaurants: [],
  cuisines: [],
};

const MORE_RESTAURANTS_LIMIT = 12;

export interface MoreRestaurantsState {
  items: RestaurantSummaryDto[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
}

const INITIAL_MORE_STATE: MoreRestaurantsState = {
  items: [],
  page: 0,
  hasMore: true,
  loading: false,
  error: null,
};

@Injectable({ providedIn: 'root' })
export class CustomerHomeStore {
  private readonly customerHomeService = inject(CustomerHomeService);
  private readonly networkStatus = inject(NetworkStatusService);

  private readonly _home = signal<CustomerHomeResponseDto>(EMPTY_HOME);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _hasLocation = signal(false);
  private readonly _lastQuery = signal<CustomerHomeQuery>({});

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

  // "Open Now" / "Fast Delivery" / "Top Rated" shelves — not part of the home response, loaded
  // separately (see CustomerHomeService) and independently, so one slow/failed shelf never blocks
  // or blanks out the others. Each carries its own loading flag for its own skeleton.
  private readonly _openNow = signal<RestaurantSummaryDto[]>([]);
  private readonly _openNowLoading = signal(false);
  private readonly _topRated = signal<RestaurantSummaryDto[]>([]);
  private readonly _topRatedLoading = signal(false);
  private readonly _fastDelivery = signal<RestaurantSummaryDto[]>([]);
  private readonly _fastDeliveryLoading = signal(false);

  readonly openNowRestaurants = this._openNow.asReadonly();
  readonly openNowLoading = this._openNowLoading.asReadonly();
  readonly topRatedRestaurants = this._topRated.asReadonly();
  readonly topRatedLoading = this._topRatedLoading.asReadonly();
  readonly fastDeliveryRestaurants = this._fastDelivery.asReadonly();
  readonly fastDeliveryLoading = this._fastDeliveryLoading.asReadonly();

  // Trailing "More restaurants" infinite-scroll section.
  private readonly _more = signal<MoreRestaurantsState>(INITIAL_MORE_STATE);
  readonly more = this._more.asReadonly();

  async loadHome(query: CustomerHomeQuery = {}): Promise<void> {
    this._lastQuery.set(query);
    this._loading.set(true);
    this._error.set(null);
    this._hasLocation.set(query.lat !== undefined && query.lng !== undefined);

    try {
      this._home.set(await this.customerHomeService.getHome(query));
    } catch {
      this._error.set(
        this.networkStatus.isOffline()
          ? "You're offline. Connect to the internet and try again."
          : 'Unable to load the home screen. Please try again.',
      );
      this._home.set(EMPTY_HOME);
    } finally {
      this._loading.set(false);
    }

    void this.loadShelves(query);
    this.resetMore();
  }

  /** Fired in parallel with, not blocking, the main home load/render — each shelf appears the
   *  moment its own request resolves rather than the whole page waiting on the slowest of four. */
  private async loadShelves(query: CustomerHomeQuery): Promise<void> {
    const coords = { latitude: query.lat, longitude: query.lng };

    this._openNowLoading.set(true);
    this.customerHomeService
      .listOpenNow(coords)
      .then((items) => this._openNow.set(items))
      .catch(() => this._openNow.set([]))
      .finally(() => this._openNowLoading.set(false));

    this._topRatedLoading.set(true);
    this.customerHomeService
      .listTopRated(coords)
      .then((items) => this._topRated.set(items))
      .catch(() => this._topRated.set([]))
      .finally(() => this._topRatedLoading.set(false));

    this._fastDeliveryLoading.set(true);
    this.customerHomeService
      .listFastDelivery(coords)
      .then((items) => this._fastDelivery.set(items))
      .catch(() => this._fastDelivery.set([]))
      .finally(() => this._fastDeliveryLoading.set(false));
  }

  private resetMore(): void {
    this._more.set(INITIAL_MORE_STATE);
    void this.loadMore();
  }

  /** Appends the next page — safe to call repeatedly (e.g. from `InfiniteScrollDirective`'s
   *  `reachedEnd`); no-ops while already loading or once the last page has been reached. */
  async loadMore(): Promise<void> {
    const current = this._more();
    if (current.loading || !current.hasMore) {
      return;
    }

    this._more.update((state) => ({ ...state, loading: true, error: null }));

    const nextPage = current.page + 1;
    const query = this._lastQuery();

    try {
      const response = await this.customerHomeService.listMore({
        page: nextPage,
        limit: MORE_RESTAURANTS_LIMIT,
        latitude: query.lat,
        longitude: query.lng,
        sortBy: 'popularity',
        sortOrder: 'desc',
      });

      this._more.update((state) => ({
        items: [...state.items, ...response.items],
        page: response.page,
        hasMore: response.page < response.totalPages,
        loading: false,
        error: null,
      }));
    } catch {
      this._more.update((state) => ({
        ...state,
        loading: false,
        error: this.networkStatus.isOffline()
          ? "You're offline — showing what's already loaded."
          : "Couldn't load more restaurants.",
      }));
    }
  }
}
