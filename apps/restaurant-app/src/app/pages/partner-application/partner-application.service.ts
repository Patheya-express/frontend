import { Injectable, inject } from '@angular/core';
import {
  RestaurantsService,
  type CreateRestaurantDto,
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

@Injectable({ providedIn: 'root' })
export class PartnerApplicationService {
  private readonly restaurantsService = inject(RestaurantsService);

  async createRestaurant(dto: CreateRestaurantDto): Promise<RestaurantResponseDto> {
    const response = await this.restaurantsService.restaurantsControllerCreateRestaurant({ body: dto });
    return unwrap(response);
  }
}
