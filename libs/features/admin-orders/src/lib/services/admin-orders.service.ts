import { Injectable, inject } from '@angular/core';
import {
  OrdersService,
  type AdminOrderResponseDto,
  type OrderResponseDto,
  type PaginatedAdminOrdersResponseDto,
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

export interface GetAdminOrdersQuery {
  page: number;
  limit: number;
  search?: string;
  status?: AdminOrderResponseDto['status'];
  restaurantId?: string;
  customerId?: string;
  deliveryPartnerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Stateless backend orchestration for the admin order management list. */
@Injectable({ providedIn: 'root' })
export class AdminOrdersService {
  private readonly ordersService = inject(OrdersService);

  async getOrders(query: GetAdminOrdersQuery): Promise<PaginatedAdminOrdersResponseDto> {
    const response = await this.ordersService.ordersControllerGetAllForAdmin(query);
    return unwrap(response);
  }

  async cancelOrder(id: string, reason?: string): Promise<OrderResponseDto> {
    const response = await this.ordersService.ordersControllerAdminCancelOrder({ id, body: { reason } });
    return unwrap(response);
  }

  async forceCompleteOrder(id: string, reason?: string): Promise<OrderResponseDto> {
    const response = await this.ordersService.ordersControllerForceCompleteOrder({ id, body: { reason } });
    return unwrap(response);
  }

  async refundOrder(id: string, reason?: string): Promise<OrderResponseDto> {
    const response = await this.ordersService.ordersControllerRefundOrder({ id, body: { reason } });
    return unwrap(response);
  }

  async reassignDeliveryPartner(id: string, deliveryPartnerId: string): Promise<OrderResponseDto> {
    const response = await this.ordersService.ordersControllerAssignDeliveryPartner({
      id,
      body: { deliveryPartnerId },
    });
    return unwrap(response);
  }
}
