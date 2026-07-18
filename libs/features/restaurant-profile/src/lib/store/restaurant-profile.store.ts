import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  RestaurantResponseDto,
  UpdateRestaurantDto,
  DocumentResponseDto,
  TaxProfileResponseDto,
  UpsertTaxProfileDto,
  BankAccountResponseDto,
  UpsertBankAccountDto,
  VerificationResponseDto,
  ComplianceResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { RestaurantContextService } from '@patheya-express-frontend/core';
import {
  RestaurantProfileService,
  type RestaurantDocumentType,
} from '../services/restaurant-profile.service';

@Injectable({ providedIn: 'root' })
export class RestaurantProfileStore {
  private readonly service = inject(RestaurantProfileService);
  private readonly context = inject(RestaurantContextService);

  private readonly _restaurant = signal<RestaurantResponseDto | null>(null);
  private readonly _documents = signal<DocumentResponseDto[]>([]);
  private readonly _taxProfile = signal<TaxProfileResponseDto | null>(null);
  private readonly _bankAccount = signal<BankAccountResponseDto | null>(null);
  private readonly _verification = signal<VerificationResponseDto | null>(null);
  private readonly _compliance = signal<ComplianceResponseDto | null>(null);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private readonly _savingProfile = signal(false);
  private readonly _uploadingDocument = signal(false);
  private readonly _savingTaxProfile = signal(false);
  private readonly _savingBankAccount = signal(false);
  private readonly _submittingVerification = signal(false);
  private readonly _actionError = signal<string | null>(null);

  readonly restaurant = this._restaurant.asReadonly();
  readonly documents = this._documents.asReadonly();
  readonly taxProfile = this._taxProfile.asReadonly();
  readonly bankAccount = this._bankAccount.asReadonly();
  readonly verification = this._verification.asReadonly();
  readonly compliance = this._compliance.asReadonly();

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly savingProfile = this._savingProfile.asReadonly();
  readonly uploadingDocument = this._uploadingDocument.asReadonly();
  readonly savingTaxProfile = this._savingTaxProfile.asReadonly();
  readonly savingBankAccount = this._savingBankAccount.asReadonly();
  readonly submittingVerification = this._submittingVerification.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly restaurantId = computed(() => this._restaurant()?.id ?? null);

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const restaurantId = await this.context.getRestaurantId();
      const [restaurant, documents, taxProfile, bankAccount, verification, compliance] =
        await Promise.all([
          this.fetchRestaurant(restaurantId),
          this.service.getDocuments(restaurantId),
          this.service.getTaxProfile(restaurantId).catch(() => null),
          this.service.getBankAccount(restaurantId).catch(() => null),
          this.service.getVerification(restaurantId).catch(() => null),
          this.service.getCompliance(restaurantId).catch(() => null),
        ]);

      this._restaurant.set(restaurant);
      this._documents.set(documents);
      this._taxProfile.set(taxProfile);
      this._bankAccount.set(bankAccount);
      this._verification.set(verification);
      this._compliance.set(compliance);
    } catch {
      this._error.set('Unable to load your restaurant profile. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  private async fetchRestaurant(restaurantId: string): Promise<RestaurantResponseDto> {
    const restaurant = this.context.currentRestaurant();

    if (restaurant && restaurant.id === restaurantId) {
      return restaurant;
    }

    // Fallback: context signal not yet populated (e.g. store used before context resolved).
    const [match] = this.context.restaurants().filter((r) => r.id === restaurantId);
    if (match) return match;

    throw new Error('Restaurant not found in context.');
  }

  async updateProfile(dto: UpdateRestaurantDto): Promise<boolean> {
    const restaurantId = this.restaurantId();
    if (!restaurantId) return false;

    this._savingProfile.set(true);
    this._actionError.set(null);

    try {
      const updated = await this.service.updateProfile(restaurantId, dto);
      this._restaurant.set(updated);
      return true;
    } catch {
      this._actionError.set('Unable to save profile changes. Please try again.');
      return false;
    } finally {
      this._savingProfile.set(false);
    }
  }

  async uploadDocument(
    documentType: RestaurantDocumentType,
    file: File,
    extra?: { documentNumber?: string; expiryDate?: string; branchId?: string },
  ): Promise<boolean> {
    const restaurantId = this.restaurantId();
    if (!restaurantId) return false;

    this._uploadingDocument.set(true);
    this._actionError.set(null);

    try {
      const document = await this.service.uploadDocument(
        restaurantId,
        documentType,
        file,
        extra,
      );
      this._documents.set([document, ...this._documents()]);
      return true;
    } catch {
      this._actionError.set('Unable to upload the document. Please try again.');
      return false;
    } finally {
      this._uploadingDocument.set(false);
    }
  }

  async removeDocument(documentId: string): Promise<boolean> {
    const restaurantId = this.restaurantId();
    if (!restaurantId) return false;

    try {
      await this.service.removeDocument(restaurantId, documentId);
      this._documents.set(this._documents().filter((d) => d.id !== documentId));
      return true;
    } catch {
      this._actionError.set('Unable to remove the document. Please try again.');
      return false;
    }
  }

  async upsertTaxProfile(dto: UpsertTaxProfileDto): Promise<boolean> {
    const restaurantId = this.restaurantId();
    if (!restaurantId) return false;

    this._savingTaxProfile.set(true);
    this._actionError.set(null);

    try {
      const profile = await this.service.upsertTaxProfile(restaurantId, dto);
      this._taxProfile.set(profile);
      return true;
    } catch {
      this._actionError.set('Unable to save the tax profile. Please try again.');
      return false;
    } finally {
      this._savingTaxProfile.set(false);
    }
  }

  async upsertBankAccount(dto: UpsertBankAccountDto): Promise<boolean> {
    const restaurantId = this.restaurantId();
    if (!restaurantId) return false;

    this._savingBankAccount.set(true);
    this._actionError.set(null);

    try {
      const account = await this.service.upsertBankAccount(restaurantId, dto);
      this._bankAccount.set(account);
      return true;
    } catch {
      this._actionError.set('Unable to save the bank account. Please try again.');
      return false;
    } finally {
      this._savingBankAccount.set(false);
    }
  }

  async submitForVerification(): Promise<boolean> {
    const restaurantId = this.restaurantId();
    if (!restaurantId) return false;

    this._submittingVerification.set(true);
    this._actionError.set(null);

    try {
      const verification = await this.service.submitForVerification(restaurantId);
      this._verification.set(verification);
      return true;
    } catch {
      this._actionError.set('Unable to submit for verification. Please try again.');
      return false;
    } finally {
      this._submittingVerification.set(false);
    }
  }
}
