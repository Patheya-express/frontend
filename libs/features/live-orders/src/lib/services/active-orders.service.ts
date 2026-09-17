import { Injectable, inject } from '@angular/core';
import { OrdersService, type PaginatedOrdersResponseDto } from '@patheya-express-frontend/api-sdk';

// The API gateway wraps every response in a { success, timestamp, data } envelope via a global
// interceptor that Swagger/the generated SDK types do not account for — same unwrap every other
// feature service in this codebase does at its own API boundary (e.g. order-details's
// OrderDetailsService), duplicated here rather than imported from order-details because that
// library is lazy-loaded via app.routes.ts while this one loads eagerly at the app shell.
interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

/**
 * Thin wrapper around the existing, already-shipped GET /orders/me endpoint
 * (OrdersService.ordersControllerGetCustomerOrders) — no new backend endpoint. Sorted newest-first
 * server-side (see OrdersRepository.findCustomerOrders), which is exactly what the floating
 * tracker needs; LiveOrdersStore filters the response down to non-terminal statuses itself.
 */
@Injectable({ providedIn: 'root' })
export class ActiveOrdersService {
  private readonly ordersService = inject(OrdersService);

  async getRecentOrders(limit: number): Promise<PaginatedOrdersResponseDto> {
    const response = await this.ordersService.ordersControllerGetCustomerOrders({ page: 1, limit });
    return unwrap(response);
  }
}
