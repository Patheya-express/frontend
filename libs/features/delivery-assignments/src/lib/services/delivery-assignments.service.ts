import { Injectable, inject } from '@angular/core';
import { DeliveryService, DispatchService, type DeliveryAssignmentResponseDto } from '@patheya-express-frontend/api-sdk';
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

/** Stateless backend orchestration for a delivery partner's assignments. */
@Injectable({ providedIn: 'root' })
export class DeliveryAssignmentsService {
  private readonly dispatchService = inject(DispatchService);
  private readonly deliveryService = inject(DeliveryService);
  private readonly currentPartner = inject(CurrentDeliveryPartnerService);

  async getAssignments(): Promise<DeliveryAssignmentResponseDto[]> {
    await this.currentPartner.getPartner();
    const response = await this.dispatchService.dispatchControllerGetAssignments();
    return unwrap(response);
  }

  async acceptAssignment(assignmentId: string): Promise<void> {
    await this.dispatchService.dispatchControllerAcceptAssignment({ id: assignmentId });
  }

  async rejectAssignment(assignmentId: string): Promise<void> {
    await this.dispatchService.dispatchControllerRejectAssignment({ id: assignmentId });
  }

  confirmPickup(orderId: string): Promise<void> {
    return this.updateDeliveryStatus(orderId, 'OUT_FOR_DELIVERY');
  }

  confirmDelivery(orderId: string): Promise<void> {
    return this.updateDeliveryStatus(orderId, 'DELIVERED');
  }

  private async updateDeliveryStatus(orderId: string, status: 'OUT_FOR_DELIVERY' | 'DELIVERED'): Promise<void> {
    await this.deliveryService.deliveryControllerUpdateDeliveryStatus({ orderId, body: { status } });
  }
}
