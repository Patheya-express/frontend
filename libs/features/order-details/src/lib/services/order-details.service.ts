import { Injectable, inject } from '@angular/core';
import { OrdersService, RestaurantsService, type OrderResponseDto } from '@patheya-express-frontend/api-sdk';

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

export interface OrderDetails {
  order: OrderResponseDto;
  restaurantName: string;
}

@Injectable({ providedIn: 'root' })
export class OrderDetailsService {
  private readonly ordersService = inject(OrdersService);
  private readonly restaurantsService = inject(RestaurantsService);

  async getOrderDetails(orderId: string): Promise<OrderDetails> {
    const orderResponse = await this.ordersService.ordersControllerGetOrderById({ id: orderId });
    const order = unwrap(orderResponse);

    const restaurantResponse = await this.restaurantsService.restaurantsControllerGetRestaurantById({
      id: order.restaurantId,
    });
    const restaurant = unwrap(restaurantResponse);

    return { order, restaurantName: restaurant.name };
  }

  async getCustomerOrders(): Promise<OrderResponseDto[]> {
    const response = await this.ordersService.ordersControllerGetCustomerOrders();
    return unwrap(response);
  }
}
