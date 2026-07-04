import { Injectable, inject } from '@angular/core';
import {
  DeliveryService,
  DispatchService,
  PresenceService,
  type DeliveryAssignmentResponseDto,
  type DeliveryPartnerResponseDto,
  type OrderResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { CurrentDeliveryPartnerService } from '@patheya-express-frontend/core';

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
 * Stateless backend orchestration for the delivery partner dashboard.
 *
 * "Online" is currently two disconnected backend systems: `DeliveryPartnerStatus` (a durable
 * DB flag toggled via /delivery/available|offline) and Redis presence (the flag dispatch
 * assignment actually checks, toggled via /presence/online|offline). Going online/offline
 * here updates both together so the toggle has real effect on receiving assignments.
 */
@Injectable({ providedIn: 'root' })
export class DeliveryDashboardService {
  private readonly deliveryService = inject(DeliveryService);
  private readonly dispatchService = inject(DispatchService);
  private readonly presenceService = inject(PresenceService);
  private readonly currentPartner = inject(CurrentDeliveryPartnerService);

  getPartner(): Promise<DeliveryPartnerResponseDto> {
    return this.currentPartner.getPartner();
  }

  async getAssignedOrders(): Promise<OrderResponseDto[]> {
    const response = await this.deliveryService.deliveryControllerGetAssignedOrders();
    return unwrap(response);
  }

  async getMyAssignments(): Promise<DeliveryAssignmentResponseDto[]> {
    const response = await this.dispatchService.dispatchControllerGetAssignments();
    return unwrap(response);
  }

  async goOnline(): Promise<DeliveryPartnerResponseDto> {
    const [partnerResponse] = await Promise.all([
      this.deliveryService.deliveryControllerGoAvailable(),
      this.presenceService.presenceControllerMarkOnline(),
    ]);
    this.currentPartner.invalidate();
    return unwrap(partnerResponse);
  }

  async goOffline(): Promise<DeliveryPartnerResponseDto> {
    const [partnerResponse] = await Promise.all([
      this.deliveryService.deliveryControllerGoOffline(),
      this.presenceService.presenceControllerMarkOffline(),
    ]);
    this.currentPartner.invalidate();
    return unwrap(partnerResponse);
  }
}
