import { Injectable, inject } from '@angular/core';
import {
  DeliveryBankAccountService as DeliveryBankAccountSdkService,
  type DeliveryBankAccountResponseDto,
  type UpsertDeliveryBankAccountDto,
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
export class DeliveryBankAccountFeatureService {
  private readonly bankAccountService = inject(DeliveryBankAccountSdkService);

  async find(): Promise<DeliveryBankAccountResponseDto | null> {
    try {
      const response = await this.bankAccountService.deliveryBankAccountControllerFind();
      return unwrap(response);
    } catch {
      return null;
    }
  }

  async upsert(dto: UpsertDeliveryBankAccountDto): Promise<DeliveryBankAccountResponseDto> {
    const response = await this.bankAccountService.deliveryBankAccountControllerUpsert({ body: dto });
    return unwrap(response);
  }
}
