import { ChangeDetectionStrategy, Component, OnInit, effect, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ErrorStateComponent, FileUploadComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { MapPickerComponent, type PickedLocation } from '@patheya-express-frontend/map-picker';
import { DeliveryOnboardingWizardFacade, ONBOARDING_TOTAL_STEPS } from '../../facades/delivery-onboarding-wizard.facade';

interface StepMeta {
  step: number;
  key: string;
  label: string;
}

const STEPS: StepMeta[] = [
  { step: 1, key: 'personal', label: 'Personal Details' },
  { step: 2, key: 'address', label: 'Address' },
  { step: 3, key: 'vehicle', label: 'Vehicle' },
  { step: 4, key: 'license', label: 'Driving License' },
  { step: 5, key: 'aadhaar', label: 'Aadhaar' },
  { step: 6, key: 'pan', label: 'PAN' },
  { step: 7, key: 'rc', label: 'Vehicle RC' },
  { step: 8, key: 'insurance', label: 'Vehicle Insurance' },
  { step: 9, key: 'bank', label: 'Bank Account' },
  { step: 10, key: 'selfie', label: 'Live Selfie' },
  { step: 11, key: 'background', label: 'Background Verification' },
  { step: 12, key: 'review', label: 'Review & Submit' },
];

const VEHICLE_TYPES = ['BIKE', 'SCOOTER', 'BICYCLE', 'CAR', 'ELECTRIC_VEHICLE'] as const;
const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const;

/**
 * 12-step mandatory onboarding wizard — single page, internal step signal (goToStep), exact
 * mirror of restaurant-onboarding's OnboardingWizardPageComponent. Every step persists through
 * the already-built profile/vehicles/documents/bank-account SDK services (never duplicated
 * here); this component only sequences them and records wizard progress via
 * DeliveryOnboardingWizardFacade. Step 11 (Background Verification) is a consent + optional
 * document upload — the backend requires it complete before submit, even though the ticket's
 * "Wizard Steps" summary folds it implicitly into review; giving it its own tiny step keeps the
 * mapping to backend steps 1-11 exact rather than special-casing submit.
 */
@Component({
  selector: 'lib-onboarding-wizard-page',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, SkeletonComponent, ErrorStateComponent, FileUploadComponent, MapPickerComponent],
  templateUrl: './onboarding-wizard-page.component.html',
  styleUrl: './onboarding-wizard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingWizardPageComponent implements OnInit {
  protected readonly facade = inject(DeliveryOnboardingWizardFacade);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly steps = STEPS;
  protected readonly totalSteps = ONBOARDING_TOTAL_STEPS;
  protected readonly vehicleTypes = VEHICLE_TYPES;
  protected readonly genders = GENDERS;

  private patched = false;

  protected initialCurrentPosition?: { lat: number; lng: number };
  protected initialPermanentPosition?: { lat: number; lng: number };

  protected readonly personalForm = this.fb.nonNullable.group({
    dateOfBirth: ['', Validators.required],
    gender: ['' as '' | (typeof GENDERS)[number], Validators.required],
    languagesSpoken: ['', Validators.required],
  });

  protected readonly addressForm = this.fb.nonNullable.group({
    currentAddressLine1: ['', Validators.required],
    currentAddressLine2: [''],
    currentCity: ['', Validators.required],
    currentState: ['', Validators.required],
    currentPostalCode: ['', Validators.required],
    currentAddressLatitude: [0, Validators.required],
    currentAddressLongitude: [0, Validators.required],
    sameAsPermanentAddress: [false],
    permanentAddressLine1: [''],
    permanentAddressLine2: [''],
    permanentCity: [''],
    permanentState: [''],
    permanentPostalCode: [''],
    permanentLatitude: [0],
    permanentLongitude: [0],
  });

  protected readonly vehicleForm = this.fb.nonNullable.group({
    vehicleType: ['BIKE' as (typeof VEHICLE_TYPES)[number], Validators.required],
    registrationNumber: ['', Validators.required],
    brand: [''],
    model: [''],
    year: [new Date().getFullYear()],
    fuelType: ['PETROL' as 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'CNG' | 'HYBRID'],
    color: [''],
  });

  protected readonly bankForm = this.fb.nonNullable.group({
    accountHolderName: ['', Validators.required],
    accountNumber: ['', [Validators.required, Validators.minLength(6)]],
    bankName: ['', Validators.required],
    branchName: [''],
    ifsc: ['', [Validators.required, Validators.pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)]],
    upiId: [''],
  });

  protected readonly backgroundConsent = new FormControl(false, {
    nonNullable: true,
    validators: [Validators.requiredTrue],
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
    const profile = this.facade.profile();
    const vehicle = this.facade.primaryVehicle();
    const bankAccount = this.facade.bankAccount();

    if (profile) {
      this.personalForm.reset({
        dateOfBirth: profile.dateOfBirth?.slice(0, 10) ?? '',
        gender: profile.gender ?? '',
        languagesSpoken: profile.languagesSpoken.join(', '),
      });

      this.addressForm.reset({
        currentAddressLine1: profile.currentAddressLine1 ?? '',
        currentAddressLine2: profile.currentAddressLine2 ?? '',
        currentCity: profile.currentCity ?? '',
        currentState: profile.currentState ?? '',
        currentPostalCode: profile.currentPostalCode ?? '',
        currentAddressLatitude: profile.currentAddressLatitude ?? 0,
        currentAddressLongitude: profile.currentAddressLongitude ?? 0,
        sameAsPermanentAddress: profile.sameAsPermanentAddress,
        permanentAddressLine1: profile.permanentAddressLine1 ?? '',
        permanentAddressLine2: profile.permanentAddressLine2 ?? '',
        permanentCity: profile.permanentCity ?? '',
        permanentState: profile.permanentState ?? '',
        permanentPostalCode: profile.permanentPostalCode ?? '',
        permanentLatitude: profile.permanentLatitude ?? 0,
        permanentLongitude: profile.permanentLongitude ?? 0,
      });

      if (profile.currentAddressLatitude !== undefined && profile.currentAddressLongitude !== undefined) {
        this.initialCurrentPosition = { lat: profile.currentAddressLatitude, lng: profile.currentAddressLongitude };
      }
      if (profile.permanentLatitude !== undefined && profile.permanentLongitude !== undefined) {
        this.initialPermanentPosition = { lat: profile.permanentLatitude, lng: profile.permanentLongitude };
      }
    }

    if (vehicle) {
      this.vehicleForm.reset({
        vehicleType: vehicle.vehicleType,
        registrationNumber: vehicle.registrationNumber,
        brand: vehicle.brand ?? '',
        model: vehicle.model ?? '',
        year: vehicle.year ?? new Date().getFullYear(),
        fuelType: vehicle.fuelType ?? 'PETROL',
        color: vehicle.color ?? '',
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

  protected hasDocument(type: 'DRIVING_LICENSE' | 'AADHAAR' | 'PAN' | 'VEHICLE_RC' | 'VEHICLE_INSURANCE' | 'SELFIE' | 'BACKGROUND_VERIFICATION'): boolean {
    return this.facade.documentsByType().has(type);
  }

  protected isUploading(key: string): boolean {
    return this.facade.uploadingKey() === key;
  }

  // --- Step 1: Personal ---
  protected onSubmitPersonal(): void {
    if (this.isStepComplete(1) && this.personalForm.pristine) {
      this.goToStep(2);
      return;
    }
    if (this.personalForm.invalid) {
      this.personalForm.markAllAsTouched();
      return;
    }
    const value = this.personalForm.getRawValue();
    void this.facade
      .savePersonal({
        dateOfBirth: value.dateOfBirth,
        gender: value.gender || undefined,
        languagesSpoken: value.languagesSpoken.split(',').map((s) => s.trim()).filter(Boolean),
      })
      .then((ok) => {
        if (ok) {
          this.personalForm.markAsPristine();
          this.goToStep(2);
        }
      });
  }

  // --- Step 2: Address ---
  protected onCurrentLocationPicked(location: PickedLocation): void {
    this.addressForm.patchValue({
      currentAddressLatitude: location.lat,
      currentAddressLongitude: location.lng,
      currentAddressLine1: location.addressLine1 || this.addressForm.controls.currentAddressLine1.value,
      currentCity: location.city || this.addressForm.controls.currentCity.value,
      currentState: location.state || this.addressForm.controls.currentState.value,
      currentPostalCode: location.postalCode || this.addressForm.controls.currentPostalCode.value,
    });
    this.addressForm.markAsDirty();
  }

  protected onPermanentLocationPicked(location: PickedLocation): void {
    this.addressForm.patchValue({
      permanentLatitude: location.lat,
      permanentLongitude: location.lng,
      permanentAddressLine1: location.addressLine1 || this.addressForm.controls.permanentAddressLine1.value,
      permanentCity: location.city || this.addressForm.controls.permanentCity.value,
      permanentState: location.state || this.addressForm.controls.permanentState.value,
      permanentPostalCode: location.postalCode || this.addressForm.controls.permanentPostalCode.value,
    });
    this.addressForm.markAsDirty();
  }

  protected onSubmitAddress(): void {
    if (this.isStepComplete(2) && this.addressForm.pristine) {
      this.goToStep(3);
      return;
    }
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }
    const value = this.addressForm.getRawValue();
    void this.facade
      .saveAddress({
        currentAddressLine1: value.currentAddressLine1,
        currentAddressLine2: value.currentAddressLine2 || undefined,
        currentCity: value.currentCity,
        currentState: value.currentState,
        currentPostalCode: value.currentPostalCode,
        currentAddressLatitude: value.currentAddressLatitude,
        currentAddressLongitude: value.currentAddressLongitude,
        sameAsPermanentAddress: value.sameAsPermanentAddress,
        permanentAddressLine1: value.sameAsPermanentAddress ? value.currentAddressLine1 : value.permanentAddressLine1 || undefined,
        permanentAddressLine2: value.sameAsPermanentAddress ? value.currentAddressLine2 : value.permanentAddressLine2 || undefined,
        permanentCity: value.sameAsPermanentAddress ? value.currentCity : value.permanentCity || undefined,
        permanentState: value.sameAsPermanentAddress ? value.currentState : value.permanentState || undefined,
        permanentPostalCode: value.sameAsPermanentAddress ? value.currentPostalCode : value.permanentPostalCode || undefined,
        permanentLatitude: value.sameAsPermanentAddress ? value.currentAddressLatitude : value.permanentLatitude || undefined,
        permanentLongitude: value.sameAsPermanentAddress ? value.currentAddressLongitude : value.permanentLongitude || undefined,
      })
      .then((ok) => {
        if (ok) {
          this.addressForm.markAsPristine();
          this.goToStep(3);
        }
      });
  }

  // --- Step 3: Vehicle ---
  protected onSubmitVehicle(): void {
    if (this.isStepComplete(3) && this.vehicleForm.pristine) {
      this.goToStep(4);
      return;
    }
    if (this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }
    const value = this.vehicleForm.getRawValue();
    void this.facade
      .saveVehicle({
        vehicleType: value.vehicleType,
        registrationNumber: value.registrationNumber,
        brand: value.brand || undefined,
        model: value.model || undefined,
        year: value.year || undefined,
        fuelType: value.fuelType,
        color: value.color || undefined,
      })
      .then((ok) => {
        if (ok) {
          this.vehicleForm.markAsPristine();
          this.goToStep(4);
        }
      });
  }

  // --- Step 4: Driving License ---
  protected onDrivingLicenseSelected(file: File): void {
    void this.facade.uploadDrivingLicense(file);
  }

  protected onContinueDrivingLicense(): void {
    void this.facade.completeDrivingLicenseStep().then((ok) => {
      if (ok) {
        this.goToStep(5);
      }
    });
  }

  // --- Step 5: Aadhaar ---
  protected onAadhaarSelected(file: File): void {
    void this.facade.uploadAadhaar(file);
  }

  protected onContinueAadhaar(): void {
    void this.facade.completeAadhaarStep().then((ok) => {
      if (ok) {
        this.goToStep(6);
      }
    });
  }

  // --- Step 6: PAN ---
  protected onPanSelected(file: File): void {
    void this.facade.uploadPan(file);
  }

  protected onContinuePan(): void {
    void this.facade.completePanStep().then((ok) => {
      if (ok) {
        this.goToStep(7);
      }
    });
  }

  // --- Step 7: Vehicle RC ---
  protected onVehicleRcSelected(file: File): void {
    void this.facade.uploadVehicleRc(file);
  }

  protected onContinueVehicleRc(): void {
    void this.facade.completeVehicleRcStep().then((ok) => {
      if (ok) {
        this.goToStep(8);
      }
    });
  }

  // --- Step 8: Vehicle Insurance (+ optional Fitness/Pollution) ---
  protected onVehicleInsuranceSelected(file: File): void {
    void this.facade.uploadVehicleInsurance(file);
  }

  protected onVehicleFitnessSelected(file: File): void {
    void this.facade.uploadVehicleFitness(file);
  }

  protected onVehiclePollutionSelected(file: File): void {
    void this.facade.uploadVehiclePollution(file);
  }

  protected onContinueVehicleInsurance(): void {
    void this.facade.completeVehicleDocumentsStep().then((ok) => {
      if (ok) {
        this.goToStep(9);
      }
    });
  }

  // --- Step 9: Bank ---
  protected onIfscInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.bankForm.controls.ifsc.setValue(input.value.toUpperCase());
  }

  protected onSubmitBank(): void {
    if (this.isStepComplete(9) && this.bankForm.pristine) {
      this.goToStep(10);
      return;
    }
    if (this.bankForm.invalid) {
      this.bankForm.markAllAsTouched();
      return;
    }
    const value = this.bankForm.getRawValue();
    void this.facade
      .saveBankDetails({
        accountHolderName: value.accountHolderName,
        accountNumber: value.accountNumber,
        bankName: value.bankName,
        branchName: value.branchName || undefined,
        ifsc: value.ifsc.toUpperCase(),
        upiId: value.upiId || undefined,
      })
      .then((ok) => {
        if (ok) {
          this.bankForm.markAsPristine();
          this.goToStep(10);
        }
      });
  }

  // --- Step 10: Selfie ---
  protected onSelfieSelected(file: File): void {
    void this.facade.uploadSelfie(file);
  }

  protected onContinueSelfie(): void {
    void this.facade.completeSelfieStep().then((ok) => {
      if (ok) {
        this.goToStep(11);
      }
    });
  }

  // --- Step 11: Background Verification ---
  protected onBackgroundDocumentSelected(file: File): void {
    void this.facade.uploadBackgroundVerificationDocument(file);
  }

  protected onContinueBackground(): void {
    if (this.backgroundConsent.invalid) {
      this.backgroundConsent.markAsTouched();
      return;
    }
    void this.facade.completeBackgroundVerificationStep().then((ok) => {
      if (ok) {
        this.goToStep(12);
      }
    });
  }

  // --- Step 12: Review ---
  protected onSubmitApplication(): void {
    if (this.acceptTerms.invalid) {
      this.acceptTerms.markAsTouched();
      return;
    }
    void this.facade.submit({ acceptedTerms: true }).then((ok) => {
      if (ok) {
        void this.router.navigateByUrl('/onboarding/waiting-approval');
      }
    });
  }

  protected retry(): void {
    this.facade.refresh();
  }
}
