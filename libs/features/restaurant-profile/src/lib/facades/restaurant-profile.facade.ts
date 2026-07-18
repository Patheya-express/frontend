import { Injectable, inject } from '@angular/core';
import type {
  UpdateRestaurantDto,
  UpsertTaxProfileDto,
  UpsertBankAccountDto,
} from '@patheya-express-frontend/api-sdk';
import { RestaurantProfileStore } from '../store/restaurant-profile.store';
import type { RestaurantDocumentType } from '../services/restaurant-profile.service';

@Injectable({ providedIn: 'root' })
export class RestaurantProfileFacade {
  private readonly store = inject(RestaurantProfileStore);

  readonly restaurant = this.store.restaurant;
  readonly documents = this.store.documents;
  readonly taxProfile = this.store.taxProfile;
  readonly bankAccount = this.store.bankAccount;
  readonly verification = this.store.verification;
  readonly compliance = this.store.compliance;

  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly savingProfile = this.store.savingProfile;
  readonly uploadingDocument = this.store.uploadingDocument;
  readonly savingTaxProfile = this.store.savingTaxProfile;
  readonly savingBankAccount = this.store.savingBankAccount;
  readonly submittingVerification = this.store.submittingVerification;
  readonly actionError = this.store.actionError;

  /** Loads the full profile. Call once on page init. */
  initialize(): void {
    void this.store.load();
  }

  refresh(): void {
    void this.store.load();
  }

  updateProfile(dto: UpdateRestaurantDto): Promise<boolean> {
    return this.store.updateProfile(dto);
  }

  uploadDocument(
    documentType: RestaurantDocumentType,
    file: File,
    extra?: { documentNumber?: string; expiryDate?: string; branchId?: string },
  ): Promise<boolean> {
    return this.store.uploadDocument(documentType, file, extra);
  }

  removeDocument(documentId: string): Promise<boolean> {
    return this.store.removeDocument(documentId);
  }

  upsertTaxProfile(dto: UpsertTaxProfileDto): Promise<boolean> {
    return this.store.upsertTaxProfile(dto);
  }

  upsertBankAccount(dto: UpsertBankAccountDto): Promise<boolean> {
    return this.store.upsertBankAccount(dto);
  }

  submitForVerification(): Promise<boolean> {
    return this.store.submitForVerification();
  }
}
