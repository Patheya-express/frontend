import { ChangeDetectionStrategy, Component, OnInit, effect, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MediaUrlService } from '@patheya-express-frontend/core';
import { ErrorStateComponent, FileUploadComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { OperatingHoursEditorComponent } from '@patheya-express-frontend/restaurant-branches';
import { MapPickerComponent, type PickedLocation } from '@patheya-express-frontend/map-picker';
import type { UpsertOperatingHourDto } from '@patheya-express-frontend/api-sdk';
import {
  OnboardingWizardFacade,
  ONBOARDING_TOTAL_STEPS,
  MANDATORY_MEDIA_TYPES,
  MANDATORY_DOCUMENT_TYPES,
} from '../../facades/onboarding-wizard.facade';
import type { OnboardingDocumentType, OnboardingMediaType } from '../../services/onboarding-wizard.service';

interface StepMeta {
  step: number;
  key: string;
  label: string;
}

const STEPS: StepMeta[] = [
  { step: 1, key: 'business', label: 'Business Details' },
  { step: 2, key: 'restaurant', label: 'Restaurant Details' },
  { step: 3, key: 'location', label: 'Location' },
  { step: 4, key: 'branch', label: 'Branch Details' },
  { step: 5, key: 'hours', label: 'Operating Hours' },
  { step: 6, key: 'bank', label: 'Bank Details' },
  { step: 7, key: 'gst', label: 'GST' },
  { step: 8, key: 'fssai', label: 'FSSAI' },
  { step: 9, key: 'pan', label: 'PAN' },
  { step: 10, key: 'media', label: 'Restaurant Media' },
  { step: 11, key: 'documents', label: 'Compliance Documents' },
  { step: 12, key: 'review', label: 'Review & Submit' },
];

const OPTIONAL_DOCUMENT_TYPES: OnboardingDocumentType[] = [
  'FIRE_NOC',
  'RENTAL_AGREEMENT',
  'UTILITY_BILL',
  'LIQUOR_LICENSE',
  'HALAL',
  'OTHER',
];

const BUSINESS_TYPES = [
  'PROPRIETORSHIP',
  'PARTNERSHIP',
  'LLP',
  'PRIVATE_LIMITED',
  'PUBLIC_LIMITED',
  'TRUST',
  'SOCIETY',
  'OTHER',
] as const;

/**
 * 12-step mandatory onboarding wizard. Every step persists through the already-completed
 * restaurant/branch/tax-profile/bank-account/media/documents endpoints (never duplicated here) —
 * this component only sequences them and records wizard progress via OnboardingWizardFacade.
 *
 * Restaurant/branch business-profile fields not yet echoed back by their GET endpoints
 * (legalBusinessName, businessEmail, businessPhone, website, brandName, tradeName, supportEmail,
 * supportPhone, and the full bank account number) cannot be safely pre-filled on resume. Those
 * specific controls only get sent back to the server when the owner has actually touched them
 * (`control.dirty`), so reopening an already-completed step and editing one field never blanks
 * out the others.
 */
@Component({
  selector: 'lib-onboarding-wizard-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    SkeletonComponent,
    ErrorStateComponent,
    FileUploadComponent,
    OperatingHoursEditorComponent,
    MapPickerComponent,
  ],
  templateUrl: './onboarding-wizard-page.component.html',
  styleUrl: './onboarding-wizard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingWizardPageComponent implements OnInit {
  protected readonly facade = inject(OnboardingWizardFacade);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly mediaUrl = inject(MediaUrlService);

  protected readonly steps = STEPS;
  protected readonly totalSteps = ONBOARDING_TOTAL_STEPS;
  protected readonly businessTypes = BUSINESS_TYPES;
  protected readonly mandatoryMediaTypes = MANDATORY_MEDIA_TYPES;
  protected readonly mandatoryDocumentTypes = MANDATORY_DOCUMENT_TYPES;
  protected readonly optionalDocumentTypes = OPTIONAL_DOCUMENT_TYPES;

  private patched = false;

  /** Prefills the map picker's marker when resuming with a branch that already has coordinates. */
  protected initialMapPosition: { lat: number; lng: number } | undefined = undefined;

  protected readonly businessForm = this.fb.nonNullable.group({
    legalBusinessName: ['', Validators.required],
    businessEmail: ['', [Validators.required, Validators.email]],
    businessPhone: [''],
    website: [''],
  });

  protected readonly restaurantForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    brandName: [''],
    tradeName: [''],
    description: [''],
    email: ['', Validators.email],
    phone: [''],
    supportEmail: ['', Validators.email],
    supportPhone: [''],
  });

  protected readonly locationForm = this.fb.nonNullable.group({
    addressLine1: ['', Validators.required],
    addressLine2: [''],
    landmark: [''],
    city: ['', Validators.required],
    state: ['', Validators.required],
    postalCode: ['', Validators.required],
    latitude: [0, [Validators.required]],
    longitude: [0, [Validators.required]],
  });

  protected readonly branchForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    deliveryRadiusKm: [5, [Validators.required, Validators.min(0.1)]],
    timezone: ['Asia/Kolkata', Validators.required],
    phone: [''],
    emergencyContactName: [''],
    emergencyContactPhone: [''],
  });

  protected readonly bankForm = this.fb.nonNullable.group({
    accountHolderName: ['', Validators.required],
    accountNumber: ['', [Validators.required, Validators.minLength(6)]],
    bankName: ['', Validators.required],
    branchName: [''],
    ifsc: ['', [Validators.required, Validators.pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)]],
    upiId: [''],
  });

  protected readonly gstForm = this.fb.nonNullable.group({
    gstin: ['', Validators.required],
    gstLegalName: ['', Validators.required],
    gstRegisteredAddress: [''],
    gstRegistrationState: [''],
    gstBusinessCategory: [''],
    businessType: ['PROPRIETORSHIP' as (typeof BUSINESS_TYPES)[number]],
  });

  protected readonly fssaiForm = this.fb.nonNullable.group({
    fssaiNumber: ['', Validators.required],
    fssaiLicenseType: [''],
    fssaiIssueDate: [''],
    fssaiExpiryAt: [''],
  });

  protected readonly panForm = this.fb.nonNullable.group({
    pan: ['', [Validators.required]],
    cin: [''],
  });

  protected readonly acceptTerms = new FormControl(false, {
    nonNullable: true,
    validators: [Validators.requiredTrue],
  });

  constructor() {
    effect(() => {
      if (!this.facade.initialized() || this.patched) {
        return;
      }
      this.patched = true;
      this.prefillForms();
    });
  }

  ngOnInit(): void {
    this.facade.initialize();
  }

  private prefillForms(): void {
    const restaurant = this.facade.restaurant();
    const branch = this.facade.branch();
    const bankAccount = this.facade.bankAccount();
    const taxProfile = this.facade.taxProfile();

    if (restaurant) {
      this.restaurantForm.reset({
        name: restaurant.name,
        brandName: '',
        tradeName: '',
        description: restaurant.description ?? '',
        email: restaurant.email ?? '',
        phone: restaurant.phone ?? '',
        supportEmail: '',
        supportPhone: '',
      });
    }

    if (branch) {
      this.locationForm.reset({
        addressLine1: branch.addressLine1,
        addressLine2: branch.addressLine2 ?? '',
        landmark: branch.landmark ?? '',
        city: branch.city,
        state: branch.state,
        postalCode: branch.postalCode,
        latitude: branch.latitude ?? 0,
        longitude: branch.longitude ?? 0,
      });

      if (branch.latitude !== undefined && branch.longitude !== undefined) {
        this.initialMapPosition = { lat: branch.latitude, lng: branch.longitude };
      }

      this.branchForm.reset({
        name: branch.name,
        deliveryRadiusKm: branch.deliveryRadiusKm ?? 5,
        timezone: branch.timezone ?? 'Asia/Kolkata',
        phone: branch.phone ?? '',
        emergencyContactName: branch.emergencyContactName ?? '',
        emergencyContactPhone: branch.emergencyContactPhone ?? '',
      });
    }

    if (bankAccount) {
      this.bankForm.reset({
        accountHolderName: bankAccount.accountHolderName,
        accountNumber: '',
        bankName: bankAccount.bankName,
        branchName: bankAccount.branchName ?? '',
        ifsc: bankAccount.ifsc,
        upiId: bankAccount.upiId ?? '',
      });
    }

    if (taxProfile) {
      this.gstForm.reset({
        gstin: taxProfile.gstin ?? '',
        gstLegalName: taxProfile.gstLegalName ?? '',
        gstRegisteredAddress: taxProfile.gstRegisteredAddress ?? '',
        gstRegistrationState: taxProfile.gstRegistrationState ?? '',
        gstBusinessCategory: taxProfile.gstBusinessCategory ?? '',
        businessType: taxProfile.businessType ?? 'PROPRIETORSHIP',
      });

      this.fssaiForm.reset({
        fssaiNumber: taxProfile.fssaiNumber ?? '',
        fssaiLicenseType: taxProfile.fssaiLicenseType ?? '',
        fssaiIssueDate: taxProfile.fssaiIssueDate?.slice(0, 10) ?? '',
        fssaiExpiryAt: taxProfile.fssaiExpiryAt?.slice(0, 10) ?? '',
      });

      this.panForm.reset({
        pan: taxProfile.pan ?? '',
        cin: taxProfile.cin ?? '',
      });
    }
  }

  protected isStepComplete(step: number): boolean {
    return this.facade.completedSteps().has(step);
  }

  protected isStepUnlocked(step: number): boolean {
    return step <= this.facade.maxUnlockedStep();
  }

  protected sectionHasRequestedChanges(key: string): boolean {
    return this.facade.changesRequested().some((item) => item.section === key);
  }

  protected goToStep(step: number): void {
    this.facade.goToStep(step);
  }

  protected resolveUrl(path: string | undefined): string | undefined {
    return this.mediaUrl.resolve(path);
  }

  /** Skips the network call entirely when an already-completed step's form hasn't been touched
   *  since it was pre-filled — resuming later should never silently overwrite saved data. */
  private async submitStep(
    stepNumber: number,
    form: FormGroup,
    save: () => Promise<boolean>,
  ): Promise<void> {
    if (this.isStepComplete(stepNumber) && form.pristine) {
      this.goToStep(Math.min(stepNumber + 1, ONBOARDING_TOTAL_STEPS));
      return;
    }

    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    const ok = await save();

    if (ok) {
      form.markAsPristine();
      this.goToStep(Math.min(stepNumber + 1, ONBOARDING_TOTAL_STEPS));
    }
  }

  private dirtyOrUndefined(control: FormControl<string>): string | undefined {
    return control.dirty ? control.value || undefined : undefined;
  }

  protected onSubmitBusiness(): void {
    void this.submitStep(1, this.businessForm, () => {
      const controls = this.businessForm.controls;
      return this.facade.saveBusinessDetails({
        legalBusinessName: this.dirtyOrUndefined(controls.legalBusinessName),
        businessEmail: this.dirtyOrUndefined(controls.businessEmail),
        businessPhone: this.dirtyOrUndefined(controls.businessPhone),
        website: this.dirtyOrUndefined(controls.website),
      });
    });
  }

  protected onSubmitRestaurant(): void {
    void this.submitStep(2, this.restaurantForm, () => {
      const value = this.restaurantForm.getRawValue();
      const controls = this.restaurantForm.controls;
      return this.facade.saveRestaurantDetails({
        name: value.name,
        description: value.description || undefined,
        email: value.email || undefined,
        phone: value.phone || undefined,
        brandName: this.dirtyOrUndefined(controls.brandName),
        tradeName: this.dirtyOrUndefined(controls.tradeName),
        supportEmail: this.dirtyOrUndefined(controls.supportEmail),
        supportPhone: this.dirtyOrUndefined(controls.supportPhone),
      });
    });
  }

  protected onLocationPicked(location: PickedLocation): void {
    this.locationForm.patchValue({
      latitude: location.lat,
      longitude: location.lng,
      addressLine1: location.addressLine1 || this.locationForm.controls.addressLine1.value,
      city: location.city || this.locationForm.controls.city.value,
      state: location.state || this.locationForm.controls.state.value,
      postalCode: location.postalCode || this.locationForm.controls.postalCode.value,
    });
    // patchValue doesn't mark controls dirty — without this, picking a new point on an
    // already-completed step would be silently skipped by submitStep()'s pristine-form check.
    this.locationForm.markAsDirty();
  }

  protected onSubmitLocation(): void {
    void this.submitStep(3, this.locationForm, () => {
      const value = this.locationForm.getRawValue();
      const existing = this.facade.branch();

      return this.facade.saveLocation({
        name: existing?.name ?? this.facade.restaurant()?.name ?? 'Main Branch',
        addressLine1: value.addressLine1,
        addressLine2: value.addressLine2 || undefined,
        landmark: value.landmark || undefined,
        city: value.city,
        state: value.state,
        postalCode: value.postalCode,
        latitude: value.latitude,
        longitude: value.longitude,
      });
    });
  }

  protected onSubmitBranch(): void {
    void this.submitStep(4, this.branchForm, () => {
      const value = this.branchForm.getRawValue();
      return this.facade.saveBranchDetails({
        name: value.name,
        deliveryRadiusKm: value.deliveryRadiusKm,
        timezone: value.timezone,
        phone: value.phone || undefined,
        emergencyContactName: value.emergencyContactName || undefined,
        emergencyContactPhone: value.emergencyContactPhone || undefined,
      });
    });
  }

  protected onSaveHours(hours: UpsertOperatingHourDto[]): void {
    void this.facade.saveOperatingHours(hours).then((ok) => {
      if (ok) {
        this.goToStep(6);
      }
    });
  }

  /** IFSC codes are always uppercase — normalizing as the owner types avoids a confusing
   *  pattern-validation failure (and a raw backend 400) caused only by casing. */
  protected onIfscInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const upper = input.value.toUpperCase();
    this.bankForm.controls.ifsc.setValue(upper);
  }

  protected onSubmitBank(): void {
    void this.submitStep(6, this.bankForm, () => {
      const value = this.bankForm.getRawValue();
      return this.facade.saveBankDetails({
        accountHolderName: value.accountHolderName,
        accountNumber: value.accountNumber,
        bankName: value.bankName,
        branchName: value.branchName || undefined,
        ifsc: value.ifsc.toUpperCase(),
        upiId: value.upiId || undefined,
      });
    });
  }

  protected onSubmitGst(): void {
    void this.submitStep(7, this.gstForm, () => {
      const value = this.gstForm.getRawValue();
      return this.facade.saveGst({
        gstin: value.gstin,
        gstLegalName: value.gstLegalName,
        gstRegisteredAddress: value.gstRegisteredAddress || undefined,
        gstRegistrationState: value.gstRegistrationState || undefined,
        gstBusinessCategory: value.gstBusinessCategory || undefined,
        businessType: value.businessType,
      });
    });
  }

  protected onSubmitFssai(): void {
    void this.submitStep(8, this.fssaiForm, () => {
      const value = this.fssaiForm.getRawValue();
      return this.facade.saveFssai({
        fssaiNumber: value.fssaiNumber,
        fssaiLicenseType: value.fssaiLicenseType || undefined,
        fssaiIssueDate: value.fssaiIssueDate || undefined,
        fssaiExpiryAt: value.fssaiExpiryAt || undefined,
      });
    });
  }

  protected onSubmitPan(): void {
    void this.submitStep(9, this.panForm, () => {
      const value = this.panForm.getRawValue();
      return this.facade.savePan({
        pan: value.pan,
        cin: value.cin || undefined,
      });
    });
  }

  protected onLogoSelected(file: File): void {
    void this.facade.uploadLogo(file);
  }

  protected onBannerSelected(file: File): void {
    void this.facade.uploadBanner(file);
  }

  protected onMediaSelected(type: OnboardingMediaType, file: File): void {
    void this.facade.uploadMediaItem(type, file);
  }

  protected onContinueMedia(): void {
    void this.facade.completeMediaStep().then((ok) => {
      if (ok) {
        this.goToStep(11);
      }
    });
  }

  protected onDocumentSelected(documentType: OnboardingDocumentType, file: File): void {
    void this.facade.uploadDocument(documentType, file);
  }

  protected onContinueDocuments(): void {
    void this.facade.completeDocumentsStep().then((ok) => {
      if (ok) {
        this.goToStep(12);
      }
    });
  }

  protected hasDocument(type: OnboardingDocumentType): boolean {
    return this.facade.documents().some((doc) => doc.documentType === type);
  }

  protected isUploading(key: string): boolean {
    return this.facade.uploadingKey() === key;
  }

  protected onSubmitApplication(): void {
    if (this.acceptTerms.invalid) {
      this.acceptTerms.markAsTouched();
      return;
    }

    void this.facade.submit().then((ok) => {
      if (ok) {
        void this.router.navigateByUrl('/onboarding/waiting-approval');
      }
    });
  }

  protected retry(): void {
    this.facade.refresh();
  }
}
