import { Injectable, inject } from '@angular/core';
import {
  CuisinesService,
  RestaurantsService,
  type CuisineResponseDto,
  type PaginatedRestaurantSummariesResponseDto,
} from '@patheya-express-frontend/api-sdk';

export type RestaurantSortBy =
  | 'name'
  | 'rating'
  | 'createdAt'
  | 'popularity'
  | 'deliveryTime'
  | 'preparationTime'
  | 'distance';

export interface RestaurantListQuery {
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
  cuisine?: string;
  featured?: boolean;
  openNow?: boolean;
  veg?: boolean;
  vegan?: boolean;
  offers?: boolean;
  minRating?: number;
  maxDeliveryTimeMinutes?: number;
  maxDistanceKm?: number;
  latitude?: number;
  longitude?: number;
  sortBy?: RestaurantSortBy;
  sortOrder?: 'asc' | 'desc';
}

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
export class RestaurantService {
  private readonly restaurantsService = inject(RestaurantsService);
  private readonly cuisinesService = inject(CuisinesService);

  async listRestaurants(query: RestaurantListQuery = {}): Promise<PaginatedRestaurantSummariesResponseDto> {
    const response = await this.restaurantsService.restaurantsControllerFindAll(query);
    return unwrap(response);
  }

  async listCuisines(): Promise<CuisineResponseDto[]> {
    const response = await this.cuisinesService.cuisinesControllerFindAll();
    return unwrap(response);
  }
}
