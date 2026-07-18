import { Injectable, inject } from '@angular/core';
import type {
  UpdateRestaurantDto,
  CreateBranchDto,
  UpdateBranchDto,
  UpsertOperatingHourDto,
  UpsertBankAccountDto,
  UpsertTaxProfileDto,
} from '@patheya-express-frontend/api-sdk';
import {
  OnboardingWizardStore,
  ONBOARDING_TOTAL_STEPS,
  MANDATORY_MEDIA_TYPES,
  MANDATORY_DOCUMENT_TYPES,
} from '../store/onboarding-wizard.store';
import type { OnboardingDocumentType, OnboardingMediaType } from '../services/onboarding-wizard.service';

export { ONBOARDING_TOTAL_STEPS, MANDATORY_MEDIA_TYPES, MANDATORY_DOCUMENT_TYPES };

@Injectable({ providedIn: 'root' })
export class OnboardingWizardFacade {
  private readonly store = inject(OnboardingWizardStore);

  readonly onboarding = this.store.onboarding;
  readonly restaurant = this.store.restaurant;
  readonly branch = this.store.branch;
  readonly operatingHours = this.store.operatingHours;
  readonly bankAccount = this.store.bankAccount;
  readonly taxProfile = this.store.taxProfile;
  readonly media = this.store.media;
  readonly documents = this.store.documents;
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
  readonly mandatoryMediaSatisfied = this.store.mandatoryMediaSatisfied;
  readonly mandatoryDocumentsSatisfied = this.store.mandatoryDocumentsSatisfied;

  initialize(): void {
    void this.store.load();
  }

  refresh(): void {
    void this.store.refresh();
  }

  goToStep(step: number): void {
    this.store.goToStep(step);
  }

  saveBusinessDetails(dto: UpdateRestaurantDto): Promise<boolean> {
    return this.store.saveBusinessDetails(dto);
  }

  saveRestaurantDetails(dto: UpdateRestaurantDto): Promise<boolean> {
    return this.store.saveRestaurantDetails(dto);
  }

  saveLocation(dto: CreateBranchDto | UpdateBranchDto): Promise<boolean> {
    return this.store.saveLocation(dto);
  }

  saveBranchDetails(dto: UpdateBranchDto): Promise<boolean> {
    return this.store.saveBranchDetails(dto);
  }

  saveOperatingHours(hours: UpsertOperatingHourDto[]): Promise<boolean> {
    return this.store.saveOperatingHours(hours);
  }

  saveBankDetails(dto: UpsertBankAccountDto): Promise<boolean> {
    return this.store.saveBankDetails(dto);
  }

  saveGst(dto: UpsertTaxProfileDto): Promise<boolean> {
    return this.store.saveGst(dto);
  }

  saveFssai(dto: UpsertTaxProfileDto): Promise<boolean> {
    return this.store.saveFssai(dto);
  }

  savePan(dto: UpsertTaxProfileDto): Promise<boolean> {
    return this.store.savePan(dto);
  }

  uploadLogo(file: File): Promise<boolean> {
    return this.store.uploadLogo(file);
  }

  uploadBanner(file: File): Promise<boolean> {
    return this.store.uploadBanner(file);
  }

  uploadMediaItem(type: OnboardingMediaType, file: File): Promise<boolean> {
    return this.store.uploadMediaItem(type, file);
  }

  completeMediaStep(): Promise<boolean> {
    return this.store.completeMediaStep();
  }

  uploadDocument(documentType: OnboardingDocumentType, file: File): Promise<boolean> {
    return this.store.uploadDocument(documentType, file);
  }

  completeDocumentsStep(): Promise<boolean> {
    return this.store.completeDocumentsStep();
  }

  submit(): Promise<boolean> {
    return this.store.submit();
  }
}
