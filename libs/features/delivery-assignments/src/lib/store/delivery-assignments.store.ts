import { Injectable, computed, inject, signal } from '@angular/core';
import type { DeliveryAssignmentResponseDto, OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { DeliveryAssignmentsService } from '../services/delivery-assignments.service';

export interface AssignmentGroups {
  active: DeliveryAssignmentResponseDto[];
  available: DeliveryAssignmentResponseDto[];
  completed: DeliveryAssignmentResponseDto[];
}

const TERMINAL_ORDER_STATUSES: ReadonlyArray<OrderResponseDto['status']> = ['DELIVERED', 'CANCELLED'];

const POLL_INTERVAL_MS = 15_000;

function buildGroups(assignments: DeliveryAssignmentResponseDto[]): AssignmentGroups {
  const groups: AssignmentGroups = { active: [], available: [], completed: [] };

  for (const assignment of assignments) {
    if (assignment.status === 'PENDING') {
      groups.available.push(assignment);
    } else if (assignment.status === 'ACCEPTED' && assignment.order) {
      if (TERMINAL_ORDER_STATUSES.includes(assignment.order.status)) {
        groups.completed.push(assignment);
      } else {
        groups.active.push(assignment);
      }
    }
  }

  return groups;
}

@Injectable({ providedIn: 'root' })
export class DeliveryAssignmentsStore {
  private readonly assignmentsService = inject(DeliveryAssignmentsService);

  private readonly _assignments = signal<DeliveryAssignmentResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _processingId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);

  private pollHandle: ReturnType<typeof setInterval> | null = null;

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly processingId = this._processingId.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly groups = computed<AssignmentGroups>(() => buildGroups(this._assignments()));

  async loadAssignments(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const assignments = await this.assignmentsService.getAssignments();
      this._assignments.set(assignments);
    } catch {
      this._error.set('Unable to load your assignments. Please try again.');
      this._assignments.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  /** Loads immediately, then refreshes in the background on an interval. Safe to call more than once. */
  startPolling(intervalMs = POLL_INTERVAL_MS): void {
    if (this.pollHandle) {
      return;
    }

    void this.loadAssignments();
    this.pollHandle = setInterval(() => void this.refreshSilently(), intervalMs);
  }

  stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      const assignments = await this.assignmentsService.getAssignments();
      this._assignments.set(assignments);
      this._error.set(null);
    } catch {
      // A transient background refresh failure shouldn't blank out an already-loaded
      // list with an error state; the next successful poll tick recovers silently.
    }
  }

  acceptAssignment(assignmentId: string): Promise<void> {
    return this.transitionAssignment(
      assignmentId,
      (assignment) => ({ ...assignment, status: 'ACCEPTED' }),
      (original) => this.assignmentsService.acceptAssignment(original.id),
    );
  }

  rejectAssignment(assignmentId: string): Promise<void> {
    return this.transitionAssignment(
      assignmentId,
      (assignment) => ({ ...assignment, status: 'REJECTED' }),
      (original) => this.assignmentsService.rejectAssignment(original.id),
    );
  }

  /** READY_FOR_PICKUP → OUT_FOR_DELIVERY. Runs through the same transition path as accept/reject. */
  confirmPickup(assignmentId: string): Promise<void> {
    return this.transitionAssignment(
      assignmentId,
      (assignment) =>
        assignment.order ? { ...assignment, order: { ...assignment.order, status: 'OUT_FOR_DELIVERY' } } : assignment,
      (original) => {
        if (!original.order) {
          return Promise.reject(new Error('Assignment has no linked order'));
        }
        return this.assignmentsService.confirmPickup(original.order.id);
      },
    );
  }

  /** OUT_FOR_DELIVERY → DELIVERED. Runs through the same transition path as accept/reject/pickup. */
  confirmDelivery(assignmentId: string): Promise<void> {
    return this.transitionAssignment(
      assignmentId,
      (assignment) =>
        assignment.order ? { ...assignment, order: { ...assignment.order, status: 'DELIVERED' } } : assignment,
      (original) => {
        if (!original.order) {
          return Promise.reject(new Error('Assignment has no linked order'));
        }
        return this.assignmentsService.confirmDelivery(original.order.id);
      },
    );
  }

  dismissActionError(): void {
    this._actionError.set(null);
  }

  /**
   * The single path every assignment transition runs through — accept, reject, pickup, and
   * delivery confirmation, each supplying their own `applyOptimistic` (what changes on the
   * assignment) and `action` (the backend call, given the pre-transition assignment so it can
   * pull whatever id it needs — assignment id for accept/reject, nested order id for
   * pickup/delivery). Optimistically applies the change, then reconciles: mutation endpoints
   * return either nothing useful or the full order, so a successful call simply keeps the
   * optimistic value; a failed call rolls back to the original.
   * `processingId`/`actionError` are shared across every transition kind on purpose — only one
   * transition can be in flight for a given assignment at a time, so a single pair of signals
   * covers accept, reject, pickup, and delivery without new per-action state.
   */
  private async transitionAssignment(
    assignmentId: string,
    applyOptimistic: (assignment: DeliveryAssignmentResponseDto) => DeliveryAssignmentResponseDto,
    action: (original: DeliveryAssignmentResponseDto) => Promise<void>,
  ): Promise<void> {
    const original = this._assignments().find((assignment) => assignment.id === assignmentId);
    if (!original) {
      return;
    }

    this._processingId.set(assignmentId);
    this.replaceAssignment(assignmentId, applyOptimistic(original));

    try {
      await action(original);
      this._actionError.set(null);
    } catch {
      this.replaceAssignment(assignmentId, original);
      this._actionError.set('Unable to update this assignment. Please try again.');
    } finally {
      this._processingId.set(null);
    }
  }

  private replaceAssignment(assignmentId: string, replacement: DeliveryAssignmentResponseDto): void {
    this._assignments.update((assignments) =>
      assignments.map((assignment) => (assignment.id === assignmentId ? replacement : assignment)),
    );
  }
}
