import { Injectable, inject } from '@angular/core';
import {
  DeliveryService,
  OrdersService,
  type AdminDeliveryPartnerResponseDto,
  type DeliveryPartnerResponseDto,
  type OrderResponseDto,
  type PaginatedAdminDeliveryPartnersResponseDto,
  type UserResponseDto,
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

export interface GetAdminDeliveryPartnersQuery {
  page: number;
  limit: number;
  search?: string;
  status?: AdminDeliveryPartnerResponseDto['status'];
  availability?: boolean;
  verified?: boolean;
  online?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

/** Stateless backend orchestration for the admin delivery partner management list. */
@Injectable({ providedIn: 'root' })
export class AdminDeliveryService {
  private readonly deliveryService = inject(DeliveryService);
  private readonly ordersService = inject(OrdersService);

  async getPartners(query: GetAdminDeliveryPartnersQuery): Promise<PaginatedAdminDeliveryPartnersResponseDto> {
    const response = await this.deliveryService.deliveryControllerGetAllForAdmin(query);
    return unwrap(response);
  }

  async approvePartner(id: string): Promise<DeliveryPartnerResponseDto> {
    const response = await this.deliveryService.deliveryControllerApprovePartner({ id });
    return unwrap(response);
  }

  async rejectPartner(id: string): Promise<DeliveryPartnerResponseDto> {
    const response = await this.deliveryService.deliveryControllerRejectPartner({ id });
    return unwrap(response);
  }

  async suspendPartner(id: string): Promise<DeliveryPartnerResponseDto> {
    const response = await this.deliveryService.deliveryControllerSuspendPartner({ id });
    return unwrap(response);
  }

  async restorePartner(id: string): Promise<DeliveryPartnerResponseDto> {
    const response = await this.deliveryService.deliveryControllerRestorePartner({ id });
    return unwrap(response);
  }

  async forceOffline(id: string): Promise<DeliveryPartnerResponseDto> {
    const response = await this.deliveryService.deliveryControllerForceOffline({ id });
    return unwrap(response);
  }

  async blockPartner(id: string): Promise<UserResponseDto> {
    const response = await this.deliveryService.deliveryControllerBlockPartner({ id });
    return unwrap(response);
  }

  async unblockPartner(id: string): Promise<UserResponseDto> {
    const response = await this.deliveryService.deliveryControllerUnblockPartner({ id });
    return unwrap(response);
  }

  /**
   * Reuses the admin reassignment endpoint Phase 10.4 already built on the Orders module
   * (PATCH /orders/:id/assign-delivery-partner) — no delivery-side reassignment logic exists
   * or is needed; this is the same call `admin-orders` makes, kept here as its own thin
   * wrapper rather than importing that feature library directly.
   */
  async reassignCurrentOrder(orderId: string, deliveryPartnerUserId: string): Promise<OrderResponseDto> {
    const response = await this.ordersService.ordersControllerAssignDeliveryPartner({
      id: orderId,
      body: { deliveryPartnerId: deliveryPartnerUserId },
    });
    return unwrap(response);
  }
}
