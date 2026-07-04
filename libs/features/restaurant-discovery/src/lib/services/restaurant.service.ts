import { Injectable, inject } from '@angular/core';
import {
  RestaurantsService,
  type PaginatedRestaurantsResponseDto,
} from '@patheya-express-frontend/api-sdk';

export interface RestaurantListQuery {
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
  cuisine?: string;
  featured?: boolean;
  openNow?: boolean;
  sortBy?: 'name' | 'rating' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// The API gateway wraps every response in a { success, timestamp, data } envelope via a
// global interceptor that Swagger/the generated SDK types do not account for.
interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class RestaurantService {
  private readonly restaurantsService = inject(RestaurantsService);

  async listRestaurants(query: RestaurantListQuery = {}): Promise<PaginatedRestaurantsResponseDto> {
    const response = await this.restaurantsService.restaurantsControllerFindAll(query);
    return (response as unknown as ApiEnvelope<PaginatedRestaurantsResponseDto>).data;
  }
}
