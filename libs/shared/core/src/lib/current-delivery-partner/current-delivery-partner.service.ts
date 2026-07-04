import { Injectable, inject } from '@angular/core';
import { DeliveryService, type DeliveryPartnerResponseDto } from '@patheya-express-frontend/api-sdk';

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
 * Resolves and caches the current user's delivery partner profile (via `/delivery/me`).
 * Shared across every delivery-facing feature (dashboard, assignments, earnings) so the
 * lookup is never duplicated. Call `invalidate()` after any mutation that changes the
 * partner's own state (e.g. going online/offline) so the next `getPartner()` re-fetches.
 */
@Injectable({ providedIn: 'root' })
export class CurrentDeliveryPartnerService {
  private readonly deliveryService = inject(DeliveryService);

  private partnerPromise: Promise<DeliveryPartnerResponseDto> | null = null;

  getPartner(): Promise<DeliveryPartnerResponseDto> {
    if (!this.partnerPromise) {
      this.partnerPromise = this.fetchPartner().catch((error) => {
        this.partnerPromise = null;
        throw error;
      });
    }
    return this.partnerPromise;
  }

  invalidate(): void {
    this.partnerPromise = null;
  }

  private async fetchPartner(): Promise<DeliveryPartnerResponseDto> {
    const response = await this.deliveryService.deliveryControllerGetMe();
    return unwrap(response);
  }
}
