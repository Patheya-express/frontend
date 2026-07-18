import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  FileUploadComponent,
  SkeletonComponent,
  StatusChipComponent,
  type StatusChipTone,
} from '@patheya-express-frontend/ui';
import { RestaurantProfileFacade } from '../../facades/restaurant-profile.facade';
import type { RestaurantDocumentType } from '../../services/restaurant-profile.service';

const DOCUMENT_TYPES: RestaurantDocumentType[] = [
  'GST',
  'FSSAI',
  'PAN',
  'TRADE_LICENSE',
  'FIRE_NOC',
  'SHOP_ESTABLISHMENT',
  'LIQUOR_LICENSE',
  'HALAL',
  'CANCELLED_CHEQUE',
  'PASSBOOK',
  'AADHAAR',
  'PAN_CARD',
  'RENTAL_AGREEMENT',
  'UTILITY_BILL',
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

// Typed as string[] (not a narrow literal tuple) so indexOf/equality checks against
// VerificationResponseDto['stage'] (which also includes REJECTED/SUSPENDED, deliberately not
// shown on this happy-path timeline) type-check without a cast.
const VERIFICATION_TIMELINE: string[] = [
  'DRAFT',
  'SUBMITTED',
  'DOCUMENT_REVIEW',
  'GST_VERIFICATION',
  'FSSAI_VERIFICATION',
  'BANK_VERIFICATION',
  'COMPLIANCE_REVIEW',
  'APPROVED',
];

@Component({
  selector: 'lib-restaurant-profile-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
    FileUploadComponent,
    StatusChipComponent,
  ],
  templateUrl: './restaurant-profile-page.component.html',
  styleUrl: './restaurant-profile-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantProfilePageComponent implements OnInit {
  protected readonly facade = inject(RestaurantProfileFacade);
  private readonly fb = inject(FormBuilder);

  protected readonly documentTypes = DOCUMENT_TYPES;
  protected readonly businessTypes = BUSINESS_TYPES;
  protected readonly verificationTimeline = VERIFICATION_TIMELINE;
  protected selectedDocumentType: RestaurantDocumentType = 'GST';

  protected readonly profileForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    legalBusinessName: [''],
    tradeName: [''],
    brandName: [''],
    description: [''],
    phone: [''],
    email: [''],
    supportEmail: [''],
    supportPhone: [''],
    businessEmail: [''],
    businessPhone: [''],
    website: [''],
  });

  protected readonly taxForm = this.fb.nonNullable.group({
    gstin: [''],
    gstLegalName: [''],
    fssaiNumber: [''],
    fssaiExpiryAt: [''],
    pan: [''],
    businessType: [''],
  });

  protected readonly bankForm = this.fb.nonNullable.group({
    accountHolderName: ['', Validators.required],
    bankName: ['', Validators.required],
    accountNumber: ['', Validators.required],
    ifsc: ['', Validators.required],
    upiId: [''],
  });

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected onProfileSubmit(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    void this.facade.updateProfile(this.profileForm.getRawValue());
  }

  protected onDocumentTypeChange(event: Event): void {
    this.selectedDocumentType = (event.target as HTMLSelectElement).value as RestaurantDocumentType;
  }

  protected onDocumentSelected(file: File): void {
    void this.facade.uploadDocument(this.selectedDocumentType, file);
  }

  protected onRemoveDocument(documentId: string): void {
    void this.facade.removeDocument(documentId);
  }

  protected documentStatusTone(status: string): StatusChipTone {
    switch (status) {
      case 'VERIFIED':
        return 'success';
      case 'REJECTED':
      case 'EXPIRED':
        return 'error';
      default:
        return 'info';
    }
  }

  protected verificationStatusTone(stage: string | undefined): StatusChipTone {
    switch (stage) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
      case 'SUSPENDED':
        return 'error';
      case 'DRAFT':
        return 'neutral';
      default:
        return 'info';
    }
  }

  protected complianceTone(status: string | undefined): StatusChipTone {
    switch (status) {
      case 'COMPLIANT':
        return 'success';
      case 'AT_RISK':
        return 'info';
      case 'NON_COMPLIANT':
        return 'error';
      default:
        return 'neutral';
    }
  }

  protected get canSubmitVerification(): boolean {
    return this.facade.verification()?.stage === 'DRAFT';
  }

  protected onSubmitVerification(): void {
    void this.facade.submitForVerification();
  }

  protected onTaxSubmit(): void {
    const value = this.taxForm.getRawValue();

    void this.facade.upsertTaxProfile({
      gstin: value.gstin || undefined,
      gstLegalName: value.gstLegalName || undefined,
      fssaiNumber: value.fssaiNumber || undefined,
      fssaiExpiryAt: value.fssaiExpiryAt || undefined,
      pan: value.pan || undefined,
      businessType: (value.businessType || undefined) as never,
    });
  }

  protected onBankSubmit(): void {
    if (this.bankForm.invalid) {
      this.bankForm.markAllAsTouched();
      return;
    }

    void this.facade.upsertBankAccount(this.bankForm.getRawValue());
  }
}
