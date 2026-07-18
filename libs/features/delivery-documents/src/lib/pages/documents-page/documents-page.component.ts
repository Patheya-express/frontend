import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ErrorStateComponent, FileUploadComponent, SkeletonComponent, StatusChipComponent, type StatusChipTone } from '@patheya-express-frontend/ui';
import type { DeliveryDocumentResponseDto } from '@patheya-express-frontend/api-sdk';
import { DOCUMENT_GROUPS, DeliveryDocumentsFacade } from '../../facades/delivery-documents.facade';
import type { DeliveryDocumentType } from '../../services/delivery-documents.service';

function statusTone(status: DeliveryDocumentResponseDto['status']): StatusChipTone {
  switch (status) {
    case 'VERIFIED':
      return 'success';
    case 'REJECTED':
    case 'EXPIRED':
      return 'error';
    case 'UNDER_REVIEW':
      return 'info';
    default:
      return 'neutral';
  }
}

const TYPE_LABELS: Record<DeliveryDocumentType, string> = {
  DRIVING_LICENSE: 'Driving License',
  AADHAAR: 'Aadhaar',
  PAN: 'PAN',
  VEHICLE_RC: 'Vehicle RC',
  VEHICLE_INSURANCE: 'Vehicle Insurance',
  VEHICLE_FITNESS: 'Vehicle Fitness Certificate',
  VEHICLE_POLLUTION: 'Pollution Certificate',
  PROFILE_PHOTO: 'Profile Photo',
  SELFIE: 'Live Selfie',
  BACKGROUND_VERIFICATION: 'Background Verification',
  VEHICLE_PHOTO: 'Vehicle Photo',
  OTHER: 'Other',
};

/** Grouped by License/Identity/Vehicle/Selfie. Each card: status, expiry, replace, preview,
 *  history — mirrors the restaurant onboarding wizard's document-upload pattern
 *  (withUpload/uploadingKey), just outside the wizard. */
@Component({
  selector: 'lib-documents-page',
  standalone: true,
  imports: [DatePipe, SkeletonComponent, ErrorStateComponent, StatusChipComponent, FileUploadComponent],
  templateUrl: './documents-page.component.html',
  styleUrl: './documents-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsPageComponent implements OnInit {
  protected readonly facade = inject(DeliveryDocumentsFacade);
  protected readonly groups = DOCUMENT_GROUPS;
  protected readonly statusTone = statusTone;
  protected readonly typeLabel = (type: DeliveryDocumentType): string => TYPE_LABELS[type];

  protected readonly historyOpenFor = signal<DeliveryDocumentType | null>(null);

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected retry(): void {
    this.facade.refresh();
  }

  protected isUploading(type: DeliveryDocumentType): boolean {
    return this.facade.uploadingKey() === type;
  }

  protected onFileSelected(type: DeliveryDocumentType, file: File): void {
    const existing = this.facade.documentsByType().get(type);
    void this.facade.upload(type, file, { previousVersionId: existing?.id });
  }

  protected openHistory(type: DeliveryDocumentType): void {
    this.historyOpenFor.set(type);
    void this.facade.loadHistory(type);
  }

  protected closeHistory(): void {
    this.historyOpenFor.set(null);
    this.facade.clearHistory();
  }

  protected removeDocument(documentId: string): void {
    void this.facade.remove(documentId);
  }
}
