import { Injectable, inject } from '@angular/core';
import type {
  UpdateDeliveryProfileDto,
  CreateVehicleDto,
  UpsertDeliveryBankAccountDto,
  SubmitDeliveryOnboardingDto,
} from '@patheya-express-frontend/api-sdk';
import { ONBOARDING_TOTAL_STEPS, DeliveryOnboardingWizardStore } from '../store/delivery-onboarding-wizard.store';

export { ONBOARDING_TOTAL_STEPS };

@Injectable({ providedIn: 'root' })
export class DeliveryOnboardingWizardFacade {
  private readonly store = inject(DeliveryOnboardingWizardStore);

  readonly onboarding = this.store.onboarding;
  readonly verification = this.store.verification;
  readonly profile = this.store.profile;
  readonly vehicles = this.store.vehicles;
  readonly documents = this.store.documents;
  readonly bankAccount = this.store.bankAccount;
  readonly activeStep = this.store.activeStep;

  readonly initializing = this.store.initializing;
  readonly initialized = this.store.initialized;
  readonly error = this.store.error;
  readonly saving = this.store.saving;
  readonly saveError = this.store.saveError;
  readonly uploadingKey = this.store.uploadingKey;

  readonly completedSteps = this.store.completedSteps;
  readonly progressPercent = this.store.progressPercent;
  readonly status = this.store.status;
  readonly changesRequested = this.store.changesRequested;
  readonly maxUnlockedStep = this.store.maxUnlockedStep;
  readonly primaryVehicle = this.store.primaryVehicle;
  readonly documentsByType = this.store.documentsByType;

  initialize(): void {
    void this.store.load();
  }

  refresh(): void {
    void this.store.refresh();
  }

  goToStep(step: number): void {
    this.store.goToStep(step);
  }

  savePersonal(dto: UpdateDeliveryProfileDto): Promise<boolean> {
    return this.store.savePersonal(dto);
  }

  saveAddress(dto: UpdateDeliveryProfileDto): Promise<boolean> {
    return this.store.saveAddress(dto);
  }

  saveVehicle(dto: CreateVehicleDto): Promise<boolean> {
    return this.store.saveVehicle(dto);
  }

  uploadDrivingLicense(file: File): Promise<boolean> {
    return this.store.uploadDrivingLicense(file);
  }

  completeDrivingLicenseStep(): Promise<boolean> {
    return this.store.completeDrivingLicenseStep();
  }

  uploadAadhaar(file: File): Promise<boolean> {
    return this.store.uploadAadhaar(file);
  }

  completeAadhaarStep(): Promise<boolean> {
    return this.store.completeAadhaarStep();
  }

  uploadPan(file: File): Promise<boolean> {
    return this.store.uploadPan(file);
  }

  completePanStep(): Promise<boolean> {
    return this.store.completePanStep();
  }

  uploadVehicleRc(file: File): Promise<boolean> {
    return this.store.uploadVehicleRc(file);
  }

  completeVehicleRcStep(): Promise<boolean> {
    return this.store.completeVehicleRcStep();
  }

  uploadVehicleInsurance(file: File): Promise<boolean> {
    return this.store.uploadVehicleInsurance(file);
  }

  uploadVehicleFitness(file: File): Promise<boolean> {
    return this.store.uploadVehicleFitness(file);
  }

  uploadVehiclePollution(file: File): Promise<boolean> {
    return this.store.uploadVehiclePollution(file);
  }

  completeVehicleDocumentsStep(): Promise<boolean> {
    return this.store.completeVehicleDocumentsStep();
  }

  saveBankDetails(dto: UpsertDeliveryBankAccountDto): Promise<boolean> {
    return this.store.saveBankDetails(dto);
  }

  uploadSelfie(file: File): Promise<boolean> {
    return this.store.uploadSelfie(file);
  }

  completeSelfieStep(): Promise<boolean> {
    return this.store.completeSelfieStep();
  }

  uploadBackgroundVerificationDocument(file: File): Promise<boolean> {
    return this.store.uploadBackgroundVerificationDocument(file);
  }

  completeBackgroundVerificationStep(): Promise<boolean> {
    return this.store.completeBackgroundVerificationStep();
  }

  submit(dto: SubmitDeliveryOnboardingDto): Promise<boolean> {
    return this.store.submit(dto);
  }
}
