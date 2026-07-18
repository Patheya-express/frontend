import { Injectable, inject } from '@angular/core';
import {
  DeliveryVerificationService as DeliveryVerificationSdkService,
  DeliveryOnboardingService as DeliveryOnboardingSdkService,
  DeliveryComplianceService as DeliveryComplianceSdkService,
  type DeliveryVerificationResponseDto,
  type VerificationHistoryEntryDto,
  type DeliveryOnboardingResponseDto,
  type DeliveryComplianceResponseDto,
} from '@patheya-express-frontend/api-sdk';

interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

@Injectable({ providedIn: 'root' })
export class DeliveryVerificationFeatureService {
  private readonly verificationService = inject(DeliveryVerificationSdkService);
  private readonly onboardingService = inject(DeliveryOnboardingSdkService);
  private readonly complianceService = inject(DeliveryComplianceSdkService);

  async getStatus(): Promise<DeliveryVerificationResponseDto> {
    const response = await this.verificationService.deliveryVerificationControllerGetStatus();
    return unwrap(response);
  }

  async getHistory(): Promise<VerificationHistoryEntryDto[]> {
    const response = await this.verificationService.deliveryVerificationControllerGetHistory();
    return unwrap(response);
  }

  async getOnboardingState(): Promise<DeliveryOnboardingResponseDto> {
    const response = await this.onboardingService.deliveryOnboardingControllerGetState();
    return unwrap(response);
  }

  async getComplianceSnapshot(): Promise<DeliveryComplianceResponseDto> {
    const response = await this.complianceService.deliveryComplianceControllerGetSnapshot();
    return unwrap(response);
  }
}
