import { Injectable, inject } from '@angular/core';
import {
  CustomerService,
  type CustomerHomeResponseDto,
  type PaginatedRestaurantSummariesResponseDto,
  type RestaurantSummaryDto,
} from '@patheya-express-frontend/api-sdk';
import { RestaurantService, type RestaurantListQuery } from '@patheya-express-frontend/restaurant-discovery';

export interface CustomerHomeQuery {
  lat?: number;
  lng?: number;
}

const SHELF_LIMIT = 10;

// The API gateway wraps every response in a { success, timestamp, data } envelope via a
// global interceptor that Swagger/the generated SDK types do not account for.
interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

@Injectable({ providedIn: 'root' })
export class CustomerHomeService {
  private readonly customerService = inject(CustomerService);
  private readonly restaurantService = inject(RestaurantService);

  async getHome(query: CustomerHomeQuery = {}): Promise<CustomerHomeResponseDto> {
    const response = await this.customerService.customerHomeControllerGetHome(query);
    return unwrap(response);
  }

  /**
   * "Open Now" / "Fast Delivery" / "Top Rated" aren't part of the `/customer/home` response —
   * they're derived entirely from the *existing* restaurant list endpoint's own filter/sort
   * query params (`openNow`, `minRating`, `sortBy`), already supported by
   * `RestaurantService.listRestaurants()` today. No backend or SDK change, just three more calls
   * to a capability that was already there.
   */
  listOpenNow(query: RestaurantListQuery = {}): Promise<RestaurantSummaryDto[]> {
    return this.listShelf({ ...query, openNow: true, sortBy: 'popularity', sortOrder: 'desc' });
  }

  listTopRated(query: RestaurantListQuery = {}): Promise<RestaurantSummaryDto[]> {
    return this.listShelf({ ...query, minRating: 4, sortBy: 'rating', sortOrder: 'desc' });
  }

  listFastDelivery(query: RestaurantListQuery = {}): Promise<RestaurantSummaryDto[]> {
    return this.listShelf({ ...query, sortBy: 'deliveryTime', sortOrder: 'asc' });
  }

  /** Backs the trailing "More restaurants" infinite-scroll section — plain paginated listing,
   *  same query shape `/restaurants` itself already uses. */
  async listMore(query: RestaurantListQuery): Promise<PaginatedRestaurantSummariesResponseDto> {
    return this.restaurantService.listRestaurants(query);
  }

  private async listShelf(query: RestaurantListQuery): Promise<RestaurantSummaryDto[]> {
    const response = await this.restaurantService.listRestaurants({ limit: SHELF_LIMIT, ...query });
    return response.items;
  }
}
