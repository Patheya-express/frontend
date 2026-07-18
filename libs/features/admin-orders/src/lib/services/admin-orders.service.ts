import { Injectable, inject } from '@angular/core';
import {
  AdminDispatchService,
  OrdersService,
  type AdminOrderResponseDto,
  type DeliveryAssignmentResponseDto,
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
  private readonly adminDispatchService = inject(AdminDispatchService);

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

  /**
   * Manual dispatch — POST /admin/orders/:orderId/assign (Admin Dispatch module). Creates a
   * PENDING DeliveryAssignment the partner still has to accept/reject; it does not immediately
   * set the order's deliveryPartnerId, and the backend rejects orders that already have a
   * partner or an active assignment (409).
   */
  async assignDeliveryPartner(orderId: string, deliveryPartnerId: string): Promise<DeliveryAssignmentResponseDto> {
    const response = await this.adminDispatchService.adminDispatchControllerAssignOrderToPartner({
      orderId,
      body: { deliveryPartnerId },
    });
    return unwrap(response);
  }
}
