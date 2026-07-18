import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ErrorStateComponent, SkeletonComponent, StatusChipComponent, type StatusChipTone } from '@patheya-express-frontend/ui';
import type { DeliveryVerificationResponseDto } from '@patheya-express-frontend/api-sdk';
import { DeliveryVerificationFacade } from '../../facades/delivery-verification.facade';

function stageTone(stage: DeliveryVerificationResponseDto['stage']): StatusChipTone {
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

/**
 * Standing verification status page — reachable both during onboarding and afterward
 * (unlike the wizard's waiting-approval/suspended pages, which are only reachable pre-approval).
 * Realtime-refreshing via DeliveryVerificationStore's socket subscription.
 */
@Component({
  selector: 'lib-verification-page',
  standalone: true,
  imports: [DatePipe, RouterLink, SkeletonComponent, ErrorStateComponent, StatusChipComponent],
  templateUrl: './verification-page.component.html',
  styleUrl: './verification-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificationPageComponent implements OnInit {
  protected readonly facade = inject(DeliveryVerificationFacade);
  protected readonly stageTone = stageTone;

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected retry(): void {
    this.facade.refresh();
  }
}
