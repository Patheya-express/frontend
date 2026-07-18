import { Injectable, inject } from '@angular/core';
import {
  DeliveryProfileService as DeliveryProfileSdkService,
  type DeliveryProfileResponseDto,
  type UpdateDeliveryProfileDto,
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
export class DeliveryProfileFeatureService {
  private readonly profileService = inject(DeliveryProfileSdkService);

  async getMyProfile(): Promise<DeliveryProfileResponseDto> {
    const response = await this.profileService.profileControllerGetMyProfile();
    return unwrap(response);
  }

  async updateMyProfile(dto: UpdateDeliveryProfileDto): Promise<DeliveryProfileResponseDto> {
    const response = await this.profileService.profileControllerUpdateMyProfile({ body: dto });
    return unwrap(response);
  }
}
