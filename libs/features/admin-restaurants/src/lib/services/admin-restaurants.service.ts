import { Injectable, inject } from '@angular/core';
import {
  RestaurantsService,
  type PaginatedRestaurantsResponseDto,
  type RestaurantResponseDto,
} from '@patheya-express-frontend/api-sdk';

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

export interface GetAdminRestaurantsQuery {
  page: number;
  limit: number;
  search?: string;
  city?: string;
  cuisine?: string;
  status?: RestaurantResponseDto['status'];
}

/** Stateless backend orchestration for the admin restaurant management list. */
@Injectable({ providedIn: 'root' })
export class AdminRestaurantsService {
  private readonly restaurantsService = inject(RestaurantsService);

  async getRestaurants(query: GetAdminRestaurantsQuery): Promise<PaginatedRestaurantsResponseDto> {
    const response = await this.restaurantsService.restaurantsControllerGetAllForAdmin(query);
    return unwrap(response);
  }

  async approveRestaurant(id: string): Promise<RestaurantResponseDto> {
    const response = await this.restaurantsService.restaurantsControllerApproveRestaurant({ id });
    return unwrap(response);
  }

  async rejectRestaurant(id: string): Promise<RestaurantResponseDto> {
    const response = await this.restaurantsService.restaurantsControllerRejectRestaurant({ id });
    return unwrap(response);
  }

  async suspendRestaurant(id: string): Promise<RestaurantResponseDto> {
    const response = await this.restaurantsService.restaurantsControllerSuspendRestaurant({ id });
    return unwrap(response);
  }

  async restoreRestaurant(id: string): Promise<RestaurantResponseDto> {
    const response = await this.restaurantsService.restaurantsControllerRestoreRestaurant({ id });
    return unwrap(response);
  }
}
