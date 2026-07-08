import { Injectable, inject } from '@angular/core';
import {
  OrdersService,
  RestaurantsService,
  TrackingService,
  type OrderLocationResponseDto,
  type OrderResponseDto,
  type OrdersControllerGetCustomerOrders$Params,
  type PaginatedOrdersResponseDto,
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

export interface OrderDetails {
  order: OrderResponseDto;
  restaurantName: string;
}

export type GetCustomerOrdersQuery = OrdersControllerGetCustomerOrders$Params;

@Injectable({ providedIn: 'root' })
export class OrderDetailsService {
  private readonly ordersService = inject(OrdersService);
  private readonly restaurantsService = inject(RestaurantsService);
  private readonly trackingService = inject(TrackingService);

  async getOrderDetails(orderId: string): Promise<OrderDetails> {
    const orderResponse = await this.ordersService.ordersControllerGetOrderById({ id: orderId });
    const order = unwrap(orderResponse);

    const restaurantResponse = await this.restaurantsService.restaurantsControllerGetRestaurantById({
      id: order.restaurantId,
    });
    const restaurant = unwrap(restaurantResponse);

    return { order, restaurantName: restaurant.name };
  }

  async getCustomerOrders(query: GetCustomerOrdersQuery): Promise<PaginatedOrdersResponseDto> {
    const response = await this.ordersService.ordersControllerGetCustomerOrders(query);
    return unwrap(response);
  }

  async getOrderLocation(orderId: string): Promise<OrderLocationResponseDto | null> {
    const response = await this.trackingService.trackingControllerGetOrderLocation({ orderId });
    return unwrap(response);
  }
}
