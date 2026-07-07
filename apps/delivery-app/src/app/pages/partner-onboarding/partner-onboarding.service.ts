import { Injectable, inject } from '@angular/core';
import {
  DeliveryService,
  type CreateDeliveryPartnerDto,
  type DeliveryPartnerResponseDto,
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

@Injectable({ providedIn: 'root' })
export class PartnerOnboardingService {
  private readonly deliveryService = inject(DeliveryService);

  async onboard(dto: CreateDeliveryPartnerDto): Promise<DeliveryPartnerResponseDto> {
    const response = await this.deliveryService.deliveryControllerOnboardPartner({ body: dto });
    return unwrap(response);
  }
}
