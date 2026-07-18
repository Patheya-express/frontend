import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  OnboardingResponseDto,
  RestaurantResponseDto,
  UpdateRestaurantDto,
  BranchResponseDto,
  CreateBranchDto,
  UpdateBranchDto,
  OperatingHourResponseDto,
  UpsertOperatingHourDto,
  BankAccountResponseDto,
  UpsertBankAccountDto,
  TaxProfileResponseDto,
  UpsertTaxProfileDto,
  MediaResponseDto,
  DocumentResponseDto,
} from '@patheya-express-frontend/api-sdk';
import {
  OnboardingWizardFeatureService,
  type OnboardingDocumentType,
  type OnboardingMediaType,
} from '../services/onboarding-wizard.service';

export const ONBOARDING_TOTAL_STEPS = 12;

/** Media types that must exist before step 10 can be marked complete. */
export const MANDATORY_MEDIA_TYPES: OnboardingMediaType[] = ['INTERIOR', 'EXTERIOR', 'KITCHEN'];

/** Document types that must exist before step 11 can be marked complete. */
export const MANDATORY_DOCUMENT_TYPES: OnboardingDocumentType[] = ['TRADE_LICENSE', 'SHOP_ESTABLISHMENT'];

@Injectable({ providedIn: 'root' })
export class OnboardingWizardStore {
  private readonly service = inject(OnboardingWizardFeatureService);

  private readonly _onboarding = signal<OnboardingResponseDto | null>(null);
  private readonly _restaurant = signal<RestaurantResponseDto | null>(null);
  private readonly _branch = signal<BranchResponseDto | null>(null);
  private readonly _operatingHours = signal<OperatingHourResponseDto[]>([]);
  private readonly _bankAccount = signal<BankAccountResponseDto | null>(null);
  private readonly _taxProfile = signal<TaxProfileResponseDto | null>(null);
  private readonly _media = signal<MediaResponseDto[]>([]);
  private readonly _documents = signal<DocumentResponseDto[]>([]);
  private readonly _activeStep = signal(1);

  private readonly _initializing = signal(false);
  private readonly _initialized = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _saving = signal(false);
  private readonly _saveError = signal<string | null>(null);
  private readonly _uploadingKey = signal<string | null>(null);

  readonly onboarding = this._onboarding.asReadonly();
  readonly restaurant = this._restaurant.asReadonly();
  readonly branch = this._branch.asReadonly();
  readonly operatingHours = this._operatingHours.asReadonly();
  readonly bankAccount = this._bankAccount.asReadonly();
  readonly taxProfile = this._taxProfile.asReadonly();
  readonly media = this._media.asReadonly();
  readonly documents = this._documents.asReadonly();
  readonly activeStep = this._activeStep.asReadonly();

  readonly initializing = this._initializing.asReadonly();
  readonly initialized = this._initialized.asReadonly();
  readonly error = this._error.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly saveError = this._saveError.asReadonly();
  readonly uploadingKey = this._uploadingKey.asReadonly();

  readonly completedSteps = computed(() => new Set(this._onboarding()?.completedSteps ?? []));
  readonly progressPercent = computed(() => this._onboarding()?.progressPercent ?? 0);
  readonly status = computed(() => this._onboarding()?.status ?? 'DRAFT');
  readonly changesRequested = computed(() => this._onboarding()?.changesRequested ?? []);

  /** Highest step index the owner is allowed to open — every completed step plus the very next one. */
  readonly maxUnlockedStep = computed(() => {
    const completed = this.completedSteps();
    let max = 1;
    for (let step = 1; step <= ONBOARDING_TOTAL_STEPS; step++) {
      if (completed.has(step)) {
        max = Math.min(step + 1, ONBOARDING_TOTAL_STEPS);
      }
    }
    return max;
  });

  readonly mandatoryMediaSatisfied = computed(() => {
    const types = new Set(this._media().map((item) => item.type));
    return MANDATORY_MEDIA_TYPES.every((type) => types.has(type));
  });

  readonly mandatoryDocumentsSatisfied = computed(() => {
    const types = new Set(this._documents().map((item) => item.documentType));
    return MANDATORY_DOCUMENT_TYPES.every((type) => types.has(type));
  });

  private loadPromise: Promise<void> | null = null;

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.fetchAll();
    }
    return this.loadPromise;
  }

  refresh(): Promise<void> {
    this.loadPromise = this.fetchAll();
    return this.loadPromise;
  }

  goToStep(step: number): void {
    if (step < 1 || step > ONBOARDING_TOTAL_STEPS) {
      return;
    }
    if (step > this.maxUnlockedStep()) {
      return;
    }
    this._activeStep.set(step);
  }

  private async fetchAll(): Promise<void> {
    this._initializing.set(true);
    this._error.set(null);

    try {
      const [onboarding, restaurant, branches, bankAccount, taxProfile, media, documents] = await Promise.all([
        this.service.getState(),
        this.service.getRestaurant(),
        this.service.getBranches(),
        this.service.getBankAccount(),
        this.service.getTaxProfile(),
        this.service.getMedia(),
        this.service.getDocuments(),
      ]);

      this._onboarding.set(onboarding);
      this._restaurant.set(restaurant);
      this._bankAccount.set(bankAccount);
      this._taxProfile.set(taxProfile);
      this._media.set(media);
      this._documents.set(documents);

      const primaryBranch = branches.find((b) => b.isPrimary) ?? branches[0] ?? null;
      this._branch.set(primaryBranch);

      if (primaryBranch) {
        const hours = await this.service.getOperatingHours(primaryBranch.id);
        this._operatingHours.set(hours);
      }

      this._activeStep.set(Math.min(onboarding.currentStep, ONBOARDING_TOTAL_STEPS));
      this._initialized.set(true);
    } catch {
      this._error.set('Unable to load your onboarding application. Please refresh and try again.');
    } finally {
      this._initializing.set(false);
    }
  }

  private async completeStep(step: number): Promise<void> {
    const onboarding = await this.service.completeStep(step);
    this._onboarding.set(onboarding);
  }

  private async withSaving<T>(action: () => Promise<T>): Promise<T | null> {
    this._saving.set(true);
    this._saveError.set(null);
    try {
      return await action();
    } catch {
      this._saveError.set('Unable to save this step. Please check the form and try again.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async saveBusinessDetails(dto: UpdateRestaurantDto): Promise<boolean> {
    const result = await this.withSaving(async () => {
      const restaurant = await this.service.updateRestaurant(dto);
      this._restaurant.set(restaurant);
      await this.completeStep(1);
    });
    return result !== null;
  }

  async saveRestaurantDetails(dto: UpdateRestaurantDto): Promise<boolean> {
    const result = await this.withSaving(async () => {
      const restaurant = await this.service.updateRestaurant(dto);
      this._restaurant.set(restaurant);
      await this.completeStep(2);
    });
    return result !== null;
  }

  async saveLocation(dto: CreateBranchDto | UpdateBranchDto): Promise<boolean> {
    const result = await this.withSaving(async () => {
      const existing = this._branch();
      const branch = existing
        ? await this.service.updateBranch(existing.id, dto as UpdateBranchDto)
        : await this.service.createBranch(dto as CreateBranchDto);
      this._branch.set(branch);
      await this.completeStep(3);
    });
    return result !== null;
  }

  async saveBranchDetails(dto: UpdateBranchDto): Promise<boolean> {
    const branch = this._branch();
    if (!branch) {
      this._saveError.set('Please complete the Location step first.');
      return false;
    }

    const result = await this.withSaving(async () => {
      const updated = await this.service.updateBranch(branch.id, dto);
      this._branch.set(updated);
      await this.completeStep(4);
    });
    return result !== null;
  }

  async saveOperatingHours(hours: UpsertOperatingHourDto[]): Promise<boolean> {
    const branch = this._branch();
    if (!branch) {
      this._saveError.set('Please complete the Branch step first.');
      return false;
    }

    const result = await this.withSaving(async () => {
      const saved = await this.service.replaceOperatingHours(branch.id, hours);
      this._operatingHours.set(saved);
      await this.completeStep(5);
    });
    return result !== null;
  }

  async saveBankDetails(dto: UpsertBankAccountDto): Promise<boolean> {
    const result = await this.withSaving(async () => {
      const bankAccount = await this.service.upsertBankAccount(dto);
      this._bankAccount.set(bankAccount);
      await this.completeStep(6);
    });
    return result !== null;
  }

  async saveGst(dto: UpsertTaxProfileDto): Promise<boolean> {
    const result = await this.withSaving(async () => {
      const taxProfile = await this.service.upsertTaxProfile(dto);
      this._taxProfile.set(taxProfile);
      await this.completeStep(7);
    });
    return result !== null;
  }

  async saveFssai(dto: UpsertTaxProfileDto): Promise<boolean> {
    const result = await this.withSaving(async () => {
      const taxProfile = await this.service.upsertTaxProfile(dto);
      this._taxProfile.set(taxProfile);
      await this.completeStep(8);
    });
    return result !== null;
  }

  async savePan(dto: UpsertTaxProfileDto): Promise<boolean> {
    const result = await this.withSaving(async () => {
      const taxProfile = await this.service.upsertTaxProfile(dto);
      this._taxProfile.set(taxProfile);
      await this.completeStep(9);
    });
    return result !== null;
  }

  async uploadLogo(file: File): Promise<boolean> {
    return this.withUpload('logo', async () => {
      const restaurant = await this.service.uploadLogo(file);
      this._restaurant.set(restaurant);
    });
  }

  async uploadBanner(file: File): Promise<boolean> {
    return this.withUpload('banner', async () => {
      const restaurant = await this.service.uploadBanner(file);
      this._restaurant.set(restaurant);
    });
  }

  async uploadMediaItem(type: OnboardingMediaType, file: File): Promise<boolean> {
    return this.withUpload(`media:${type}`, async () => {
      const item = await this.service.uploadMedia(type, file);
      this._media.update((existing) => [...existing.filter((m) => m.id !== item.id), item]);
    });
  }

  async completeMediaStep(): Promise<boolean> {
    if (!this.mandatoryMediaSatisfied() || !this._restaurant()?.logoUrl || !this._restaurant()?.bannerUrl) {
      this._saveError.set('Logo, banner, interior, exterior, and kitchen photos are all required.');
      return false;
    }

    const result = await this.withSaving(() => this.completeStep(10));
    return result !== null;
  }

  async uploadDocument(documentType: OnboardingDocumentType, file: File): Promise<boolean> {
    return this.withUpload(`document:${documentType}`, async () => {
      const document = await this.service.uploadDocument(documentType, file);
      this._documents.update((existing) => [...existing.filter((d) => d.documentType !== documentType), document]);
    });
  }

  async completeDocumentsStep(): Promise<boolean> {
    if (!this.mandatoryDocumentsSatisfied()) {
      this._saveError.set('Trade License and Shop Establishment documents are both required.');
      return false;
    }

    const result = await this.withSaving(() => this.completeStep(11));
    return result !== null;
  }

  async submit(): Promise<boolean> {
    const result = await this.withSaving(async () => {
      const onboarding = await this.service.submit({ acceptedTerms: true });
      this._onboarding.set(onboarding);
    });
    return result !== null;
  }

  private async withUpload(key: string, action: () => Promise<void>): Promise<boolean> {
    this._uploadingKey.set(key);
    this._saveError.set(null);
    try {
      await action();
      return true;
    } catch {
      this._saveError.set('Unable to upload this file. Please try again.');
      return false;
    } finally {
      this._uploadingKey.set(null);
    }
  }
}
