import { Injectable, inject } from '@angular/core';
import { DeliveryAssignmentsStore } from '../store/delivery-assignments.store';

@Injectable({ providedIn: 'root' })
export class DeliveryAssignmentsFacade {
  private readonly store = inject(DeliveryAssignmentsStore);

  readonly groups = this.store.groups;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly processingId = this.store.processingId;
  readonly actionError = this.store.actionError;

  /** Starts the assignment list loading and begins background polling. Call once on page init. */
  initialize(): void {
    this.store.startPolling();
  }

  /** Stops background polling. Call on page destroy. */
  dispose(): void {
    this.store.stopPolling();
  }

  refresh(): Promise<void> {
    return this.store.loadAssignments();
  }

  acceptAssignment(assignmentId: string): Promise<void> {
    return this.store.acceptAssignment(assignmentId);
  }

  rejectAssignment(assignmentId: string): Promise<void> {
    return this.store.rejectAssignment(assignmentId);
  }

  confirmPickup(assignmentId: string): Promise<void> {
    return this.store.confirmPickup(assignmentId);
  }

  confirmDelivery(assignmentId: string): Promise<void> {
    return this.store.confirmDelivery(assignmentId);
  }

  dismissActionError(): void {
    this.store.dismissActionError();
  }
}
