import { Injectable, inject } from '@angular/core';
import {
  DeliveryProofService,
  OrdersService,
  RestaurantsService,
  TrackingService,
  type OrderLocationResponseDto,
  type OrderResponseDto,
  type OrdersControllerGetCustomerOrders$Params,
  type PaginatedOrdersResponseDto,
  type ProofPhotoResponseDto,
  type RestaurantArrivalResponseDto,
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
  private readonly deliveryProofService = inject(DeliveryProofService);

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

  /** Payment/order lifecycle Rule 4 ("Continue with COD") — switches an unpaid ONLINE order to
   *  COD. The backend enforces eligibility (still PENDING, not already paid, caller owns the
   *  order); this just forwards the request and unwraps the response envelope. */
  async switchToCod(orderId: string): Promise<OrderResponseDto> {
    const response = await this.ordersService.ordersControllerSwitchToCod({ id: orderId });
    return unwrap(response);
  }

  /** Throws (404) if no pickup photo has been uploaded yet — callers treat that as "not available yet", matching getOrderLocation's null-when-not-trackable shape. Reference/evidence only (2026-09-16 revision) — nothing here requires customer approval. */
  async getPickupPhoto(orderId: string): Promise<ProofPhotoResponseDto> {
    const response = await this.deliveryProofService.proofControllerGetPickupPhoto({ orderId });
    return unwrap(response);
  }

  /** Whether/when the assigned rider marked arrival at the restaurant — see ProofService.markRestaurantArrival. */
  async getArrivalStatus(orderId: string): Promise<RestaurantArrivalResponseDto> {
    const response = await this.deliveryProofService.proofControllerGetArrivalStatus({ orderId });
    return unwrap(response);
  }
}
