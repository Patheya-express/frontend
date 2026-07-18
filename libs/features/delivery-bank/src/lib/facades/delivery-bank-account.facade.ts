import { Injectable, inject } from '@angular/core';
import type { UpsertDeliveryBankAccountDto } from '@patheya-express-frontend/api-sdk';
import { DeliveryBankAccountStore } from '../store/delivery-bank-account.store';

@Injectable({ providedIn: 'root' })
export class DeliveryBankAccountFacade {
  private readonly store = inject(DeliveryBankAccountStore);

  readonly bankAccount = this.store.bankAccount;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly saving = this.store.saving;
  readonly saveError = this.store.saveError;
  readonly saveSuccessMessage = this.store.saveSuccessMessage;

  initialize(): void {
    void this.store.load();
  }

  refresh(): void {
    void this.store.refresh();
  }

  upsert(dto: UpsertDeliveryBankAccountDto): Promise<boolean> {
    return this.store.upsert(dto);
  }
}
