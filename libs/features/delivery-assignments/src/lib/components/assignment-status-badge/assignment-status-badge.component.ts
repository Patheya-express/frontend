import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { DeliveryAssignmentResponseDto } from '@patheya-express-frontend/api-sdk';

const STATUS_LABELS: Record<DeliveryAssignmentResponseDto['status'], string> = {
  PENDING: 'Available',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
};

const STATUS_TONES: Record<DeliveryAssignmentResponseDto['status'], string> = {
  PENDING: 'info',
  ASSIGNED: 'info',
  ACCEPTED: 'success',
  REJECTED: 'error',
  EXPIRED: 'neutral',
};

/**
 * Assignment status is a different enum from order status (PENDING/ASSIGNED/ACCEPTED/
 * REJECTED/EXPIRED vs the order lifecycle), so this is a distinct, feature-local component
 * rather than a variant of the shared OrderStatusBadgeComponent.
 */
@Component({
  selector: 'lib-assignment-status-badge',
  standalone: true,
  templateUrl: './assignment-status-badge.component.html',
  styleUrl: './assignment-status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentStatusBadgeComponent {
  @Input({ required: true }) status!: DeliveryAssignmentResponseDto['status'];

  protected get label(): string {
    return STATUS_LABELS[this.status];
  }

  protected get tone(): string {
    return STATUS_TONES[this.status];
  }
}
