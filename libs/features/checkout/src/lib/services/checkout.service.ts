import { Injectable, inject } from '@angular/core';
import { OrdersService, type CreateOrderDto, type OrderResponseDto } from '@patheya-express-frontend/api-sdk';

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
export class CheckoutService {
  private readonly ordersService = inject(OrdersService);

  async placeOrder(dto: CreateOrderDto): Promise<OrderResponseDto> {
    const response = await this.ordersService.ordersControllerPlaceOrder({ body: dto });
    return unwrap(response);
  }
}
