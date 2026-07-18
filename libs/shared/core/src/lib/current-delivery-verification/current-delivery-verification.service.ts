import { Injectable, inject } from '@angular/core';
import { DeliveryVerificationService, type DeliveryVerificationResponseDto } from '@patheya-express-frontend/api-sdk';

interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

/**
 * Resolves and caches the current delivery partner's verification status (via
 * `/delivery/verification`). Lives in shared/core (always eagerly bundled) specifically so the
 * always-visible header badge can read it without statically importing the `delivery-verification`
 * feature lib, which is lazy-loaded via its own route — @nx/enforce-module-boundaries forbids an
 * eagerly-bundled file from statically importing a lazy-loaded library. Mirrors
 * CurrentDeliveryPartnerService's cache/invalidate pattern exactly.
 */
@Injectable({ providedIn: 'root' })
export class CurrentDeliveryVerificationService {
  private readonly verificationService = inject(DeliveryVerificationService);

  private verificationPromise: Promise<DeliveryVerificationResponseDto> | null = null;

  getVerification(): Promise<DeliveryVerificationResponseDto> {
    if (!this.verificationPromise) {
      this.verificationPromise = this.fetchVerification().catch((error) => {
        this.verificationPromise = null;
        throw error;
      });
    }
    return this.verificationPromise;
  }

  invalidate(): void {
    this.verificationPromise = null;
  }

  private async fetchVerification(): Promise<DeliveryVerificationResponseDto> {
    const response = await this.verificationService.deliveryVerificationControllerGetStatus();
    return unwrap(response);
  }
}
