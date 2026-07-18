import { Injectable, inject } from '@angular/core';
import { OrdersService, type RestaurantDashboardResponseDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantContextService } from '@patheya-express-frontend/core';

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
 * Stateless backend orchestration for the restaurant dashboard. Every metric is computed
 * server-side by GET /orders/restaurant/:id/dashboard (OrdersService.getRestaurantDashboard) —
 * this service (and the Store above it) only fetches and renders that response, it never
 * re-derives metrics from a raw order list.
 */
@Injectable({ providedIn: 'root' })
export class RestaurantDashboardService {
  private readonly ordersService = inject(OrdersService);
  private readonly currentRestaurant = inject(RestaurantContextService);

  async getDashboard(branchId?: string): Promise<RestaurantDashboardResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.ordersService.ordersControllerGetRestaurantDashboard({
      restaurantId,
      branchId,
    });
    return unwrap(response);
  }
}
