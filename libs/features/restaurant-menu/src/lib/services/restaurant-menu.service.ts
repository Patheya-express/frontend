import { Injectable, inject } from '@angular/core';
import {
  MenuService,
  RestaurantsService,
  type MenuCategoryResponseDto,
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
export class RestaurantMenuService {
  private readonly restaurantsService = inject(RestaurantsService);
  private readonly menuService = inject(MenuService);

  async getRestaurant(restaurantId: string): Promise<RestaurantResponseDto> {
    const response = await this.restaurantsService.restaurantsControllerGetRestaurantById({ id: restaurantId });
    return unwrap(response);
  }

  async getMenu(restaurantId: string): Promise<MenuCategoryResponseDto[]> {
    const response = await this.menuService.menuControllerGetRestaurantMenu({ restaurantId });
    return unwrap(response);
  }
}
