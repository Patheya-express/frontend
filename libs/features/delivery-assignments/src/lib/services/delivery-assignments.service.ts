import { Injectable, inject } from '@angular/core';
import {
  DeliveryProofService,
  DeliveryService,
  DispatchService,
  type DeliveryAssignmentResponseDto,
  type OrderResponseDto,
  type ProofOtpGeneratedResponseDto,
  type ProofOtpStatusResponseDto,
  type ProofPhotoResponseDto,
  type RestaurantArrivalResponseDto,
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
  private readonly deliveryService = inject(DeliveryService);
  private readonly currentPartner = inject(CurrentDeliveryPartnerService);

  async getAssignments(): Promise<DeliveryAssignmentResponseDto[]> {
    await this.currentPartner.getPartner();
    const response =
      await this.dispatchService.dispatchControllerGetAssignments();
    return unwrap(response);
  }

  async acceptAssignment(assignmentId: string): Promise<void> {
    await this.dispatchService.dispatchControllerAcceptAssignment({
      id: assignmentId,
    });
  }

  async rejectAssignment(assignmentId: string): Promise<void> {
    await this.dispatchService.dispatchControllerRejectAssignment({
      id: assignmentId,
    });
  }

  /**
   * 2026-10-11 pickup revision — pickup has no OTP. Completing pickup is the existing
   * delivery-status transition READY_FOR_PICKUP → OUT_FOR_DELIVERY; the backend only allows it for
   * the assigned partner once the parcel photo exists (OrdersService.updateOrderStatus), and the
   * photo itself can only be uploaded after the backend-validated restaurant arrival.
   */
  async confirmPickup(orderId: string): Promise<OrderResponseDto> {
    const response =
      await this.deliveryService.deliveryControllerUpdateDeliveryStatus({
        orderId,
        body: { status: 'OUT_FOR_DELIVERY' },
      });
    return unwrap(response);
  }

  // Delivery Proof & Trust — DELIVERED is only reachable through a successful delivery-OTP
  // verification below (the backend rejects a direct status update without a verified OTP).
  async generateDeliveryOtp(
    orderId: string,
  ): Promise<ProofOtpGeneratedResponseDto> {
    const response =
      await this.deliveryProofService.proofControllerGenerateDeliveryOtp({
        orderId,
      });
    return unwrap(response);
  }

  async verifyDeliveryOtp(
    orderId: string,
    code: string,
  ): Promise<ProofOtpStatusResponseDto> {
    const response =
      await this.deliveryProofService.proofControllerVerifyDeliveryOtp({
        orderId,
        body: { code },
      });
    return unwrap(response);
  }

  // Mandatory pickup-parcel photo — write-once evidence required before the order can advance to
  // OUT_FOR_DELIVERY (see ProofService.uploadPickupPhoto/OrdersService.assertPhotoVerifiedForStatus).
  async uploadPickupPhoto(
    orderId: string,
    file: File,
  ): Promise<ProofPhotoResponseDto> {
    const response =
      await this.deliveryProofService.proofControllerUploadPickupPhoto({
        orderId,
        body: { file },
      });
    return unwrap(response);
  }

  // 2026-09-16 business-workflow revision — "I've Arrived" at the restaurant. The backend is
  // authoritative: it validates these coordinates against the order's real pickup location and a
  // 100m radius (see ProofService.markRestaurantArrival) — this call can fail with a clear
  // "too far away" message, which is not a bug, it's the gate working.
  async markRestaurantArrival(
    orderId: string,
    latitude: number,
    longitude: number,
  ): Promise<RestaurantArrivalResponseDto> {
    const response =
      await this.deliveryProofService.proofControllerMarkRestaurantArrival({
        orderId,
        body: { latitude, longitude },
      });
    return unwrap(response);
  }
}
