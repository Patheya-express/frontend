import { ChangeDetectionStrategy, Component, OnInit, effect, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ErrorStateComponent, SkeletonComponent, StatusChipComponent, type StatusChipTone } from '@patheya-express-frontend/ui';
import { MapPickerComponent, type PickedLocation } from '@patheya-express-frontend/map-picker';
import { DeliveryVerificationFacade } from '@patheya-express-frontend/delivery-verification';
import type { DeliveryVerificationResponseDto } from '@patheya-express-frontend/api-sdk';
import { DeliveryProfileFacade } from '../../facades/delivery-profile.facade';

const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const;

function stageTone(stage: DeliveryVerificationResponseDto['stage'] | undefined): StatusChipTone {
  switch (stage) {
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
    case 'SUSPENDED':
      return 'error';
    case undefined:
    case 'DRAFT':
      return 'neutral';
    default:
      return 'info';
  }
}

/** Enterprise profile page: editable personal details/addresses/languages/emergency contact,
 *  view-only verification status/completion/joined date/partner id. */
@Component({
  selector: 'lib-profile-page',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, SkeletonComponent, ErrorStateComponent, StatusChipComponent, MapPickerComponent],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent implements OnInit {
  protected readonly facade = inject(DeliveryProfileFacade);
  protected readonly verificationFacade = inject(DeliveryVerificationFacade);
  private readonly fb = inject(FormBuilder);

  protected readonly genders = GENDERS;
  protected readonly stageTone = stageTone;

  protected initialCurrentPosition?: { lat: number; lng: number };
  protected initialPermanentPosition?: { lat: number; lng: number };

  protected readonly personalForm = this.fb.nonNullable.group({
    dateOfBirth: [''],
    gender: ['' as '' | (typeof GENDERS)[number]],
    languagesSpoken: [''],
  });

  protected readonly currentAddressForm = this.fb.nonNullable.group({
    currentAddressLine1: ['', []],
    currentAddressLine2: [''],
    currentCity: [''],
    currentState: [''],
    currentPostalCode: [''],
    currentAddressLatitude: [0],
    currentAddressLongitude: [0],
  });

  protected readonly permanentAddressForm = this.fb.nonNullable.group({
    sameAsPermanentAddress: [false],
    permanentAddressLine1: [''],
    permanentAddressLine2: [''],
    permanentCity: [''],
    permanentState: [''],
    permanentPostalCode: [''],
    permanentLatitude: [0],
    permanentLongitude: [0],
  });

  protected readonly emergencyContactForm = this.fb.nonNullable.group({
    emergencyContactName: [''],
    emergencyContactPhone: [''],
    emergencyContactRelation: [''],
  });

  private patched = false;

  constructor() {
    effect(() => {
      const profile = this.facade.profile();
      if (!profile || this.patched) {
        return;
      }
      this.patched = true;
      this.prefillForms();
    });
  }

  ngOnInit(): void {
    this.facade.initialize();
    this.verificationFacade.initialize();
  }

  private prefillForms(): void {
    const profile = this.facade.profile();
    if (!profile) {
      return;
    }

    this.personalForm.reset({
      dateOfBirth: profile.dateOfBirth?.slice(0, 10) ?? '',
      gender: profile.gender ?? '',
      languagesSpoken: profile.languagesSpoken.join(', '),
    });

    this.currentAddressForm.reset({
      currentAddressLine1: profile.currentAddressLine1 ?? '',
      currentAddressLine2: profile.currentAddressLine2 ?? '',
      currentCity: profile.currentCity ?? '',
      currentState: profile.currentState ?? '',
      currentPostalCode: profile.currentPostalCode ?? '',
      currentAddressLatitude: profile.currentAddressLatitude ?? 0,
      currentAddressLongitude: profile.currentAddressLongitude ?? 0,
    });

    if (profile.currentAddressLatitude !== undefined && profile.currentAddressLongitude !== undefined) {
      this.initialCurrentPosition = { lat: profile.currentAddressLatitude, lng: profile.currentAddressLongitude };
    }

    this.permanentAddressForm.reset({
      sameAsPermanentAddress: profile.sameAsPermanentAddress,
      permanentAddressLine1: profile.permanentAddressLine1 ?? '',
      permanentAddressLine2: profile.permanentAddressLine2 ?? '',
      permanentCity: profile.permanentCity ?? '',
      permanentState: profile.permanentState ?? '',
      permanentPostalCode: profile.permanentPostalCode ?? '',
      permanentLatitude: profile.permanentLatitude ?? 0,
      permanentLongitude: profile.permanentLongitude ?? 0,
    });

    if (profile.permanentLatitude !== undefined && profile.permanentLongitude !== undefined) {
      this.initialPermanentPosition = { lat: profile.permanentLatitude, lng: profile.permanentLongitude };
    }

    this.emergencyContactForm.reset({
      emergencyContactName: profile.emergencyContactName ?? '',
      emergencyContactPhone: profile.emergencyContactPhone ?? '',
      emergencyContactRelation: profile.emergencyContactRelation ?? '',
    });
  }

  protected retry(): void {
    this.facade.refresh();
  }

  protected onCurrentLocationPicked(location: PickedLocation): void {
    this.currentAddressForm.patchValue({
      currentAddressLatitude: location.lat,
      currentAddressLongitude: location.lng,
      currentAddressLine1: location.addressLine1 || this.currentAddressForm.controls.currentAddressLine1.value,
      currentCity: location.city || this.currentAddressForm.controls.currentCity.value,
      currentState: location.state || this.currentAddressForm.controls.currentState.value,
      currentPostalCode: location.postalCode || this.currentAddressForm.controls.currentPostalCode.value,
    });
    this.currentAddressForm.markAsDirty();
  }

  protected onPermanentLocationPicked(location: PickedLocation): void {
    this.permanentAddressForm.patchValue({
      permanentLatitude: location.lat,
      permanentLongitude: location.lng,
      permanentAddressLine1: location.addressLine1 || this.permanentAddressForm.controls.permanentAddressLine1.value,
      permanentCity: location.city || this.permanentAddressForm.controls.permanentCity.value,
      permanentState: location.state || this.permanentAddressForm.controls.permanentState.value,
      permanentPostalCode: location.postalCode || this.permanentAddressForm.controls.permanentPostalCode.value,
    });
    this.permanentAddressForm.markAsDirty();
  }

  protected onSubmitPersonal(): void {
    const value = this.personalForm.getRawValue();
    void this.facade.update({
      dateOfBirth: value.dateOfBirth || undefined,
      gender: value.gender || undefined,
      languagesSpoken: value.languagesSpoken
        ? value.languagesSpoken.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    });
  }

  protected onSubmitCurrentAddress(): void {
    const value = this.currentAddressForm.getRawValue();
    void this.facade.update({
      currentAddressLine1: value.currentAddressLine1 || undefined,
      currentAddressLine2: value.currentAddressLine2 || undefined,
      currentCity: value.currentCity || undefined,
      currentState: value.currentState || undefined,
      currentPostalCode: value.currentPostalCode || undefined,
      currentAddressLatitude: value.currentAddressLatitude || undefined,
      currentAddressLongitude: value.currentAddressLongitude || undefined,
    });
  }

  protected onSubmitPermanentAddress(): void {
    const value = this.permanentAddressForm.getRawValue();
    void this.facade.update({
      sameAsPermanentAddress: value.sameAsPermanentAddress,
      permanentAddressLine1: value.permanentAddressLine1 || undefined,
      permanentAddressLine2: value.permanentAddressLine2 || undefined,
      permanentCity: value.permanentCity || undefined,
      permanentState: value.permanentState || undefined,
      permanentPostalCode: value.permanentPostalCode || undefined,
      permanentLatitude: value.permanentLatitude || undefined,
      permanentLongitude: value.permanentLongitude || undefined,
    });
  }

  protected onSubmitEmergencyContact(): void {
    const value = this.emergencyContactForm.getRawValue();
    void this.facade.update({
      emergencyContactName: value.emergencyContactName || undefined,
      emergencyContactPhone: value.emergencyContactPhone || undefined,
      emergencyContactRelation: value.emergencyContactRelation || undefined,
    });
  }
}
