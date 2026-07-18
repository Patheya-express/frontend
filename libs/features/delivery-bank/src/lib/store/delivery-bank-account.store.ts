import { Injectable, inject, signal } from '@angular/core';
import type { DeliveryBankAccountResponseDto, UpsertDeliveryBankAccountDto } from '@patheya-express-frontend/api-sdk';
import { DeliveryBankAccountFeatureService } from '../services/delivery-bank-account.service';

@Injectable({ providedIn: 'root' })
export class DeliveryBankAccountStore {
  private readonly service = inject(DeliveryBankAccountFeatureService);

  private readonly _bankAccount = signal<DeliveryBankAccountResponseDto | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _saving = signal(false);
  private readonly _saveError = signal<string | null>(null);
  private readonly _saveSuccessMessage = signal<string | null>(null);

  readonly bankAccount = this._bankAccount.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly saveError = this._saveError.asReadonly();
  readonly saveSuccessMessage = this._saveSuccessMessage.asReadonly();

  private loadPromise: Promise<void> | null = null;

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.fetch();
    }
    return this.loadPromise;
  }

  refresh(): Promise<void> {
    this.loadPromise = this.fetch();
    return this.loadPromise;
  }

  private async fetch(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const account = await this.service.find();
      this._bankAccount.set(account);
    } catch {
      this._error.set('Unable to load your bank account details. Please refresh and try again.');
    } finally {
      this._loading.set(false);
    }
  }

  async upsert(dto: UpsertDeliveryBankAccountDto): Promise<boolean> {
    this._saving.set(true);
    this._saveError.set(null);
    this._saveSuccessMessage.set(null);
    try {
      const account = await this.service.upsert(dto);
      this._bankAccount.set(account);
      this._saveSuccessMessage.set('Bank account saved. It will be reviewed before verification is granted.');
      return true;
    } catch {
      this._saveError.set('Unable to save your bank account. Please check the form and try again.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }
}
