import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  DeliveryOnboardingResponseDto,
  DeliveryVerificationResponseDto,
  DeliveryProfileResponseDto,
  UpdateDeliveryProfileDto,
  VehicleResponseDto,
  CreateVehicleDto,
  DeliveryDocumentResponseDto,
  DeliveryBankAccountResponseDto,
  UpsertDeliveryBankAccountDto,
  SubmitDeliveryOnboardingDto,
} from '@patheya-express-frontend/api-sdk';
import { CurrentDeliveryPartnerService } from '@patheya-express-frontend/core';
import {
  DeliveryOnboardingWizardService,
  type DeliveryDocumentType,
} from '../services/delivery-onboarding-wizard.service';

export const ONBOARDING_TOTAL_STEPS = 12;

@Injectable({ providedIn: 'root' })
export class DeliveryOnboardingWizardStore {
  private readonly service = inject(DeliveryOnboardingWizardService);
  private readonly currentDeliveryPartnerService = inject(CurrentDeliveryPartnerService);

  private readonly _onboarding = signal<DeliveryOnboardingResponseDto | null>(null);
  private readonly _verification = signal<DeliveryVerificationResponseDto | null>(null);
  private readonly _profile = signal<DeliveryProfileResponseDto | null>(null);
  private readonly _vehicles = signal<VehicleResponseDto[]>([]);
  private readonly _documents = signal<DeliveryDocumentResponseDto[]>([]);
  private readonly _bankAccount = signal<DeliveryBankAccountResponseDto | null>(null);
  private readonly _activeStep = signal(1);

  private readonly _initializing = signal(false);
  private readonly _initialized = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _saving = signal(false);
  private readonly _saveError = signal<string | null>(null);
  private readonly _uploadingKey = signal<string | null>(null);

  readonly onboarding = this._onboarding.asReadonly();
  readonly verification = this._verification.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly vehicles = this._vehicles.asReadonly();
  readonly documents = this._documents.asReadonly();
  readonly bankAccount = this._bankAccount.asReadonly();
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

  readonly primaryVehicle = computed(() => this._vehicles().find((v) => v.isPrimary) ?? this._vehicles()[0] ?? null);

  readonly documentsByType = computed(() => {
    const map = new Map<DeliveryDocumentType, DeliveryDocumentResponseDto>();
    for (const doc of this._documents()) {
      map.set(doc.documentType, doc);
    }
    return map;
  });

  /** Highest step index the partner is allowed to open — every completed step plus the very next one. */
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
      const [onboarding, verification, profile, vehicles, documents, bankAccount] = await Promise.all([
        this.service.getState(),
        this.service.getVerification(),
        this.service.getProfile(),
        this.service.getVehicles(),
        this.service.getDocuments(),
        this.service.getBankAccount(),
      ]);

      this._onboarding.set(onboarding);
      this._verification.set(verification);
      this._profile.set(profile);
      this._vehicles.set(vehicles);
      this._documents.set(documents);
      this._bankAccount.set(bankAccount);

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

  async savePersonal(dto: UpdateDeliveryProfileDto): Promise<boolean> {
    const result = await this.withSaving(async () => {
      const profile = await this.service.updateProfile(dto);
      this._profile.set(profile);
      await this.completeStep(1);
    });
    return result !== null;
  }

  async saveAddress(dto: UpdateDeliveryProfileDto): Promise<boolean> {
    const result = await this.withSaving(async () => {
      const profile = await this.service.updateProfile(dto);
      this._profile.set(profile);
      await this.completeStep(2);
    });
    return result !== null;
  }

  async saveVehicle(dto: CreateVehicleDto): Promise<boolean> {
    const result = await this.withSaving(async () => {
      const vehicle = await this.service.createVehicle(dto);
      this._vehicles.update((existing) => [...existing, vehicle]);
      await this.completeStep(3);
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
      this._saveError.set('Unable to upload this document. Please try again.');
      return false;
    } finally {
      this._uploadingKey.set(null);
    }
  }

  private async uploadAndReplace(documentType: DeliveryDocumentType, file: File, vehicleId?: string): Promise<void> {
    const existing = this.documentsByType().get(documentType);
    const document = await this.service.uploadDocument(documentType, file, {
      vehicleId,
      previousVersionId: existing?.id,
    });
    this._documents.update((docs) => [...docs.filter((d) => d.documentType !== documentType), document]);
  }

  uploadDrivingLicense(file: File): Promise<boolean> {
    return this.withUpload('DRIVING_LICENSE', () => this.uploadAndReplace('DRIVING_LICENSE', file));
  }

  async completeDrivingLicenseStep(): Promise<boolean> {
    const result = await this.withSaving(() => this.completeStep(4));
    return result !== null;
  }

  uploadAadhaar(file: File): Promise<boolean> {
    return this.withUpload('AADHAAR', () => this.uploadAndReplace('AADHAAR', file));
  }

  async completeAadhaarStep(): Promise<boolean> {
    const result = await this.withSaving(() => this.completeStep(5));
    return result !== null;
  }

  uploadPan(file: File): Promise<boolean> {
    return this.withUpload('PAN', () => this.uploadAndReplace('PAN', file));
  }

  async completePanStep(): Promise<boolean> {
    const result = await this.withSaving(() => this.completeStep(6));
    return result !== null;
  }

  uploadVehicleRc(file: File): Promise<boolean> {
    const vehicleId = this.primaryVehicle()?.id;
    return this.withUpload('VEHICLE_RC', () => this.uploadAndReplace('VEHICLE_RC', file, vehicleId));
  }

  async completeVehicleRcStep(): Promise<boolean> {
    const result = await this.withSaving(() => this.completeStep(7));
    return result !== null;
  }

  uploadVehicleInsurance(file: File): Promise<boolean> {
    const vehicleId = this.primaryVehicle()?.id;
    return this.withUpload('VEHICLE_INSURANCE', () => this.uploadAndReplace('VEHICLE_INSURANCE', file, vehicleId));
  }

  uploadVehicleFitness(file: File): Promise<boolean> {
    const vehicleId = this.primaryVehicle()?.id;
    return this.withUpload('VEHICLE_FITNESS', () => this.uploadAndReplace('VEHICLE_FITNESS', file, vehicleId));
  }

  uploadVehiclePollution(file: File): Promise<boolean> {
    const vehicleId = this.primaryVehicle()?.id;
    return this.withUpload('VEHICLE_POLLUTION', () => this.uploadAndReplace('VEHICLE_POLLUTION', file, vehicleId));
  }

  async completeVehicleDocumentsStep(): Promise<boolean> {
    const result = await this.withSaving(() => this.completeStep(8));
    return result !== null;
  }

  async saveBankDetails(dto: UpsertDeliveryBankAccountDto): Promise<boolean> {
    const result = await this.withSaving(async () => {
      const bankAccount = await this.service.upsertBankAccount(dto);
      this._bankAccount.set(bankAccount);
      await this.completeStep(9);
    });
    return result !== null;
  }

  uploadSelfie(file: File): Promise<boolean> {
    return this.withUpload('SELFIE', () => this.uploadAndReplace('SELFIE', file));
  }

  async completeSelfieStep(): Promise<boolean> {
    const result = await this.withSaving(() => this.completeStep(10));
    return result !== null;
  }

  uploadBackgroundVerificationDocument(file: File): Promise<boolean> {
    return this.withUpload('BACKGROUND_VERIFICATION', () => this.uploadAndReplace('BACKGROUND_VERIFICATION', file));
  }

  async completeBackgroundVerificationStep(): Promise<boolean> {
    const result = await this.withSaving(() => this.completeStep(11));
    return result !== null;
  }

  async submit(dto: SubmitDeliveryOnboardingDto): Promise<boolean> {
    const result = await this.withSaving(async () => {
      const onboarding = await this.service.submit(dto);
      this._onboarding.set(onboarding);
      this.currentDeliveryPartnerService.invalidate();
    });
    return result !== null;
  }
}
