import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
} from '@angular/core';
import type {
  AssignmentOrderSummaryDto,
  DeliveryAssignmentResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { ConfirmDialogComponent } from '@patheya-express-frontend/ui';
import { NavigationService } from '@patheya-express-frontend/core';
import { DeliveryAssignmentsFacade } from '../../facades/delivery-assignments.facade';
import { AssignmentStatusBadgeComponent } from '../assignment-status-badge/assignment-status-badge.component';
import { AssignmentItemsComponent } from '../assignment-items/assignment-items.component';

interface AssignmentAction {
  key:
    | 'accept'
    | 'reject'
    | 'markArrival'
    | 'takePickupPhoto'
    | 'confirmPickup'
    | 'confirmDelivery';
  label: string;
  tone: 'primary' | 'danger';
  disabled?: boolean;
  run: () => void;
}

interface NavigateTarget {
  url: string;
  label: string;
}

@Component({
  selector: 'lib-assignment-card',
  standalone: true,
  imports: [
    AssignmentStatusBadgeComponent,
    AssignmentItemsComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './assignment-card.component.html',
  styleUrl: './assignment-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentCardComponent {
  @Input({ required: true }) assignment!: DeliveryAssignmentResponseDto;

  private readonly facade = inject(DeliveryAssignmentsFacade);
  private readonly navigationService = inject(NavigationService);

  protected rejectDialogOpen = false;

  protected get order(): AssignmentOrderSummaryDto | undefined {
    return this.assignment.order;
  }

  protected get customerName(): string | null {
    const customer = this.order?.customer;
    if (!customer) {
      return null;
    }
    return [customer.firstName, customer.lastName].filter(Boolean).join(' ');
  }

  protected get pickupAddress(): string | null {
    const branch = this.order?.branch;
    if (!branch) {
      return null;
    }
    return [
      branch.addressLine1,
      branch.addressLine2,
      branch.city,
      branch.state,
      branch.postalCode,
    ]
      .filter(Boolean)
      .join(', ');
  }

  protected get isPending(): boolean {
    return this.assignment.status === 'PENDING';
  }

  /** Accepted, but the order hasn't left the restaurant yet — this is the pickup window. */
  protected get isAwaitingPickup(): boolean {
    return (
      this.assignment.status === 'ACCEPTED' &&
      this.order?.status === 'READY_FOR_PICKUP'
    );
  }

  /** Client-side display only — the actual 100m geofence check is backend-authoritative (see
   *  ProofService.markRestaurantArrival); this just decides which pickup-window action to show. */
  protected get hasArrivedAtRestaurant(): boolean {
    return !!this.assignment.arrivedAtRestaurantAt;
  }

  /** Accepted, picked up, on the way — this is the delivery window. */
  protected get isAwaitingDelivery(): boolean {
    return (
      this.assignment.status === 'ACCEPTED' &&
      this.order?.status === 'OUT_FOR_DELIVERY'
    );
  }

  protected get isProcessing(): boolean {
    return this.facade.processingId() === this.assignment.id;
  }

  /**
   * One line telling the partner what happens next, derived only from the server-provided
   * assignment/order state (never a client-side status of its own).
   */
  protected get stageMessage(): string | null {
    if (this.isPending) {
      return 'New delivery assignment — accept or reject it before the offer expires.';
    }
    if (this.isAwaitingPickup) {
      if (!this.hasArrivedAtRestaurant) {
        return "Head to the restaurant. Tap I've Arrived when you're within 100 m.";
      }
      return this.order?.pickupPhotoUploaded
        ? 'Parcel photo uploaded. Confirm pickup to start the delivery.'
        : 'You have arrived. Upload the parcel photo to continue.';
    }
    if (this.isAwaitingDelivery) {
      return 'Head to the customer. Ask them for the delivery code to complete the order.';
    }
    if (
      this.assignment.status === 'ACCEPTED' &&
      this.order?.status === 'DELIVERED'
    ) {
      return 'Delivered.';
    }
    if (this.order?.status === 'CANCELLED') {
      return 'This order was cancelled.';
    }
    return null;
  }

  /**
   * Delegates entirely to NavigationService — the card never builds map URLs itself. Points at
   * the restaurant while awaiting pickup, or the customer while awaiting delivery.
   */
  protected get navigateTarget(): NavigateTarget | null {
    if (this.isAwaitingPickup) {
      const branch = this.order?.branch;
      const url = this.navigationService.buildMapsUrl({
        latitude: branch?.latitude,
        longitude: branch?.longitude,
        address: this.pickupAddress ?? undefined,
      });
      return url ? { url, label: 'Navigate to Restaurant' } : null;
    }

    if (this.isAwaitingDelivery) {
      const url = this.navigationService.buildMapsUrl({
        latitude: this.order?.latitude,
        longitude: this.order?.longitude,
        address: this.order?.deliveryAddress,
      });
      return url ? { url, label: 'Navigate to Customer' } : null;
    }

    return null;
  }

  /**
   * The set of mutating actions available for this assignment right now. Adding a new
   * transition means adding another configured entry here, not another conditional block
   * in the template.
   */
  protected get actions(): AssignmentAction[] {
    if (this.isPending) {
      return [
        {
          key: 'accept',
          label: this.isProcessing ? 'Processing…' : 'Accept',
          tone: 'primary',
          run: () => this.accept(),
        },
        {
          key: 'reject',
          label: 'Reject',
          tone: 'danger',
          run: () => this.requestReject(),
        },
      ];
    }

    if (this.isAwaitingPickup) {
      if (!this.hasArrivedAtRestaurant) {
        return [
          {
            key: 'markArrival',
            label: this.isProcessing
              ? 'Checking your location…'
              : "I've Arrived",
            tone: 'primary',
            run: () => this.markArrival(),
          },
        ];
      }

      if (!this.order?.pickupPhotoUploaded) {
        return [
          {
            key: 'takePickupPhoto',
            label: 'Upload Parcel Photo',
            tone: 'primary',
            run: () => this.takePickupPhoto(),
          },
        ];
      }

      return [
        {
          key: 'confirmPickup',
          label: this.isProcessing ? 'Confirming…' : 'Confirm Pickup',
          tone: 'primary',
          run: () => this.confirmPickup(),
        },
      ];
    }

    if (this.isAwaitingDelivery) {
      // 2026-09-16 business-workflow revision — customer parcel confirmation was removed from the
      // workflow; the delivery OTP is no longer blocked on anything beyond pickup having
      // completed (which isAwaitingDelivery itself already implies).
      return [
        {
          key: 'confirmDelivery',
          label: 'Enter Delivery Code',
          tone: 'primary',
          run: () => this.confirmDelivery(),
        },
      ];
    }

    return [];
  }

  protected accept(): void {
    if (this.isProcessing) {
      return;
    }
    void this.facade.acceptAssignment(this.assignment.id);
  }

  protected requestReject(): void {
    if (this.isProcessing) {
      return;
    }
    this.rejectDialogOpen = true;
  }

  protected confirmReject(): void {
    this.rejectDialogOpen = false;
    void this.facade.rejectAssignment(this.assignment.id);
  }

  protected cancelReject(): void {
    this.rejectDialogOpen = false;
  }

  protected markArrival(): void {
    if (this.isProcessing) {
      return;
    }
    void this.facade.markRestaurantArrival(this.assignment.id);
  }

  protected takePickupPhoto(): void {
    this.facade.openPickupPhotoDialog(this.assignment.id);
  }

  protected confirmPickup(): void {
    if (this.isProcessing) {
      return;
    }
    void this.facade.confirmPickup(this.assignment.id);
  }

  protected confirmDelivery(): void {
    void this.facade.openDeliveryOtpDialog(this.assignment.id);
  }
}
