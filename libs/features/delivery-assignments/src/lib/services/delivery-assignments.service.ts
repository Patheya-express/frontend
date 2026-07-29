import { Injectable, inject } from '@angular/core';
import {
  DeliveryProofService,
  DispatchService,
  type DeliveryAssignmentResponseDto,
  type ProofOtpGeneratedResponseDto,
  type ProofOtpStatusResponseDto,
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

/** Stateless backend orchestration for a delivery partner's assignments. */
@Injectable({ providedIn: 'root' })
export class DeliveryAssignmentsService {
  private readonly dispatchService = inject(DispatchService);
  private readonly deliveryProofService = inject(DeliveryProofService);
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

  // Sprint 4.1 — Delivery Proof & Trust. Pickup/delivery status no longer changes via a direct
  // status-update call (the backend now rejects that path for delivery partners); it only
  // advances as a side effect of a successful OTP verification below.
  async generatePickupOtp(orderId: string): Promise<ProofOtpGeneratedResponseDto> {
    const response = await this.deliveryProofService.proofControllerGeneratePickupOtp({ orderId });
    return unwrap(response);
  }

  async verifyPickupOtp(orderId: string, code: string): Promise<ProofOtpStatusResponseDto> {
    const response = await this.deliveryProofService.proofControllerVerifyPickupOtp({ orderId, body: { code } });
    return unwrap(response);
  }

  async generateDeliveryOtp(orderId: string): Promise<ProofOtpGeneratedResponseDto> {
    const response = await this.deliveryProofService.proofControllerGenerateDeliveryOtp({ orderId });
    return unwrap(response);
  }

  async verifyDeliveryOtp(orderId: string, code: string): Promise<ProofOtpStatusResponseDto> {
    const response = await this.deliveryProofService.proofControllerVerifyDeliveryOtp({ orderId, body: { code } });
    return unwrap(response);
  }
}
