import { Injectable, computed, inject, signal } from '@angular/core';
import type { DeliveryAssignmentResponseDto, OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { extractHttpErrorMessage } from '@patheya-express-frontend/core';
import { DeliveryAssignmentsService } from '../services/delivery-assignments.service';

export interface AssignmentGroups {
  active: DeliveryAssignmentResponseDto[];
  available: DeliveryAssignmentResponseDto[];
  completed: DeliveryAssignmentResponseDto[];
}

export type ProofType = 'pickup' | 'delivery';

/** Drives the Pickup/Delivery OTP dialog. One dialog can be open at a time, for one assignment. */
export interface OtpDialogState {
  assignmentId: string;
  orderId: string;
  type: ProofType;
  expiresAt: string | null;
  maxAttempts: number | null;
  attemptsRemaining: number | null;
  generating: boolean;
  verifying: boolean;
  error: string | null;
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
  private readonly _otpDialog = signal<OtpDialogState | null>(null);

  private pollHandle: ReturnType<typeof setInterval> | null = null;

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly processingId = this._processingId.asReadonly();
  readonly actionError = this._actionError.asReadonly();
  readonly otpDialog = this._otpDialog.asReadonly();

  readonly groups = computed<AssignmentGroups>(() => buildGroups(this._assignments()));

  constructor() {
    // Without this, a delivery partner who logs out while this page is mounted keeps polling
    // `getAssignments()` against an invalid session until the component happens to be destroyed.
    inject(LogoutCleanupRegistry).register(() => this.stopPolling());
  }

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

  /**
   * Opens the Pickup OTP dialog for this assignment and immediately requests a fresh code
   * (sent to the customer) — matching the ORDER FLOW spec's "Arrive Restaurant → Pickup OTP
   * Verification" step: tapping "Confirm Pickup" both opens the dialog and generates the code
   * in one motion, rather than requiring a separate "send code" tap first.
   */
  openPickupOtpDialog(assignmentId: string): Promise<void> {
    return this.openOtpDialog(assignmentId, 'pickup');
  }

  /** Same as openPickupOtpDialog, for the OUT_FOR_DELIVERY → DELIVERED step. */
  openDeliveryOtpDialog(assignmentId: string): Promise<void> {
    return this.openOtpDialog(assignmentId, 'delivery');
  }

  closeOtpDialog(): void {
    this._otpDialog.set(null);
  }

  /** Re-requests a fresh code for whichever dialog is currently open — this is also how a partner recovers from an expired or attempt-exceeded OTP, since generate always overwrites the previous code server-side. */
  async regenerateOtp(): Promise<void> {
    const dialog = this._otpDialog();
    if (!dialog) {
      return;
    }

    this._otpDialog.set({ ...dialog, generating: true, error: null });

    try {
      const generated =
        dialog.type === 'pickup'
          ? await this.assignmentsService.generatePickupOtp(dialog.orderId)
          : await this.assignmentsService.generateDeliveryOtp(dialog.orderId);

      this._otpDialog.set({
        ...dialog,
        generating: false,
        error: null,
        expiresAt: generated.expiresAt,
        maxAttempts: generated.maxAttempts,
        attemptsRemaining: generated.maxAttempts,
      });
    } catch (error) {
      this._otpDialog.set({
        ...dialog,
        generating: false,
        error: extractHttpErrorMessage(error, 'Unable to send a new code. Please try again.'),
      });
    }
  }

  /** Verifies the code the partner entered. On success the order's status advances server-side (as a side effect of verification, not a separate call) and the dialog closes. */
  async verifyOtp(code: string): Promise<void> {
    const dialog = this._otpDialog();
    if (!dialog || dialog.verifying) {
      return;
    }

    this._otpDialog.set({ ...dialog, verifying: true, error: null });

    try {
      const result =
        dialog.type === 'pickup'
          ? await this.assignmentsService.verifyPickupOtp(dialog.orderId, code)
          : await this.assignmentsService.verifyDeliveryOtp(dialog.orderId, code);

      this.replaceAssignmentOrderStatus(dialog.assignmentId, result.orderStatus);
      this._otpDialog.set(null);
    } catch (error) {
      const current = this._otpDialog();
      if (!current) {
        return;
      }
      this._otpDialog.set({
        ...current,
        verifying: false,
        error: extractHttpErrorMessage(error, 'Unable to verify this code. Please try again.'),
      });
    }
  }

  private async openOtpDialog(assignmentId: string, type: ProofType): Promise<void> {
    const assignment = this._assignments().find((item) => item.id === assignmentId);
    if (!assignment?.order) {
      return;
    }

    this._otpDialog.set({
      assignmentId,
      orderId: assignment.order.id,
      type,
      expiresAt: null,
      maxAttempts: null,
      attemptsRemaining: null,
      generating: true,
      verifying: false,
      error: null,
    });

    await this.regenerateOtp();
  }

  private replaceAssignmentOrderStatus(assignmentId: string, status: OrderResponseDto['status']): void {
    this._assignments.update((assignments) =>
      assignments.map((assignment) =>
        assignment.id === assignmentId && assignment.order
          ? { ...assignment, order: { ...assignment.order, status } }
          : assignment,
      ),
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
