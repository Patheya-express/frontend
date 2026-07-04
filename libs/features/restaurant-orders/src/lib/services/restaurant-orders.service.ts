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

/** Stateless backend orchestration for a restaurant owner's incoming orders. */
@Injectable({ providedIn: 'root' })
export class RestaurantOrdersService {
  private readonly ordersService = inject(OrdersService);
  private readonly currentRestaurant = inject(CurrentRestaurantService);

  async getRestaurantOrders(): Promise<OrderResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.ordersService.ordersControllerGetRestaurantOrders({ restaurantId });
    return unwrap(response);
  }

  async acceptOrder(orderId: string): Promise<OrderResponseDto> {
    const response = await this.ordersService.ordersControllerAcceptOrder({ id: orderId });
    return unwrap(response);
  }

  async rejectOrder(orderId: string): Promise<OrderResponseDto> {
    const response = await this.ordersService.ordersControllerRejectOrder({ id: orderId });
    return unwrap(response);
  }

  async prepareOrder(orderId: string): Promise<OrderResponseDto> {
    const response = await this.ordersService.ordersControllerPrepareOrder({ id: orderId });
    return unwrap(response);
  }

  async readyOrder(orderId: string): Promise<OrderResponseDto> {
    const response = await this.ordersService.ordersControllerReadyOrder({ id: orderId });
    return unwrap(response);
  }
}
