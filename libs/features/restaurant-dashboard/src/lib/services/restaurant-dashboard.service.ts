import { Injectable, inject } from '@angular/core';
import { OrdersService, type OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { CurrentRestaurantService } from '@patheya-express-frontend/core';

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

/**
 * Stateless backend orchestration for the restaurant dashboard.
 *
 * There is no analytics/reporting endpoint, so metrics are derived (in the Store) from the
 * same order list the restaurant-orders feature uses. This service independently calls the
 * SDK rather than depending on RestaurantOrdersService, keeping the two features isolated.
 */
@Injectable({ providedIn: 'root' })
export class RestaurantDashboardService {
  private readonly ordersService = inject(OrdersService);
  private readonly currentRestaurant = inject(CurrentRestaurantService);

  async getRestaurantOrders(): Promise<OrderResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.ordersService.ordersControllerGetRestaurantOrders({ restaurantId });
    return unwrap(response);
  }
}
