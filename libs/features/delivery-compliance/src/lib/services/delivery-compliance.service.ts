import { Injectable, inject } from '@angular/core';
import {
  DeliveryComplianceService as DeliveryComplianceSdkService,
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
export class DeliveryComplianceFeatureService {
  private readonly complianceService = inject(DeliveryComplianceSdkService);

  async getSnapshot(): Promise<DeliveryComplianceResponseDto> {
    const response = await this.complianceService.deliveryComplianceControllerGetSnapshot();
    return unwrap(response);
  }
}
