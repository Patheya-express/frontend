import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ErrorStateComponent, SkeletonComponent, StatusChipComponent, type StatusChipTone } from '@patheya-express-frontend/ui';
import type { DeliveryComplianceResponseDto } from '@patheya-express-frontend/api-sdk';
import { DeliveryComplianceFacade } from '../../facades/delivery-compliance.facade';

function overallTone(status: DeliveryComplianceResponseDto['overallStatus']): StatusChipTone {
  switch (status) {
    case 'COMPLIANT':
      return 'success';
    case 'NON_COMPLIANT':
      return 'error';
    default:
      return 'info';
  }
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  DRIVING_LICENSE: 'Driving License',
  AADHAAR: 'Aadhaar',
  PAN: 'PAN',
  VEHICLE_RC: 'Vehicle RC',
  VEHICLE_INSURANCE: 'Vehicle Insurance',
  VEHICLE_FITNESS: 'Vehicle Fitness Certificate',
  VEHICLE_POLLUTION: 'Pollution Certificate',
  PROFILE_PHOTO: 'Profile Photo',
  SELFIE: 'Selfie',
  BACKGROUND_VERIFICATION: 'Background Verification',
  VEHICLE_PHOTO: 'Vehicle Photo',
  OTHER: 'Other',
};

@Component({
  selector: 'lib-compliance-page',
  standalone: true,
  imports: [DatePipe, ErrorStateComponent, SkeletonComponent, StatusChipComponent],
  templateUrl: './compliance-page.component.html',
  styleUrl: './compliance-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompliancePageComponent implements OnInit {
  protected readonly facade = inject(DeliveryComplianceFacade);
  protected readonly overallTone = overallTone;
  protected readonly documentTypeLabel = (type: string): string => DOCUMENT_TYPE_LABELS[type] ?? type;

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected retry(): void {
    this.facade.refresh();
  }
}
