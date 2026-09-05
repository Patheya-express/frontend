import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type {
  DeliveryAssignmentResponseDto,
  OrderResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import {
  MobilePlatformService,
  extractHttpErrorMessage,
} from '@patheya-express-frontend/core';
import { classifyNetworkError } from '@patheya-express-frontend/mobile-networking';
import { NetworkStatusService } from '@patheya-express-frontend/ui';
import { ActiveAssignmentCacheService } from '../services/active-assignment-cache.service';
import { CourierLocationService } from '../services/courier-location.service';
import { DeliveryAssignmentsService } from '../services/delivery-assignments.service';

export interface AssignmentGroups {
  active: DeliveryAssignmentResponseDto[];
  available: DeliveryAssignmentResponseDto[];
  completed: DeliveryAssignmentResponseDto[];
}

export type ProofType = 'pickup' | 'delivery';

/**
 * Whether the currently-displayed active assignment (`groups().active`) can be trusted as
 * current, per M3's stale-data policy:
 *  - `'fresh'`   — came directly from the most recent successful backend fetch.
 *  - `'stale'`   — being shown from a local cache restore, or kept on screen after a failed
 *                  revalidation attempt (M3.7: a failed refresh must never delete useful state,
 *                  it just can no longer vouch for it).
 *  - `'offline'` — no active assignment to show, and the device is currently offline — distinct
 *                  from `'empty'` so the UI can say "can't check right now" rather than
 *                  "confirmed: nothing active."
 *  - `'empty'`   — confirmed, while online, that there is no active assignment.
 *  - `'error'`   — the initial load failed, there is no cached fallback, and the device isn't
 *                  reporting offline (e.g. a 5xx) — nothing useful can be shown.
 */
export type ActiveAssignmentStatus =
  | 'fresh'
  | 'stale'
  | 'offline'
  | 'empty'
  | 'error';

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

const TERMINAL_ORDER_STATUSES: ReadonlyArray<OrderResponseDto['status']> = [
  'DELIVERED',
  'CANCELLED',
];

const POLL_INTERVAL_MS = 15_000;

const OFFLINE_MUTATION_MESSAGE =
  "You're offline — reconnect to update this delivery.";

function buildGroups(
  assignments: DeliveryAssignmentResponseDto[],
): AssignmentGroups {
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
  private readonly courierLocationService = inject(CourierLocationService);
  private readonly activeAssignmentCache = inject(ActiveAssignmentCacheService);
  private readonly networkStatus = inject(NetworkStatusService);
  private readonly mobilePlatform = inject(MobilePlatformService);

  private readonly _assignments = signal<DeliveryAssignmentResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _processingId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);
  private readonly _otpDialog = signal<OtpDialogState | null>(null);

  /** `null` until the first fetch attempt resolves one way or another. See `ActiveAssignmentStatus`. */
  private readonly _activeAssignmentSource = signal<'fresh' | 'cache' | null>(
    null,
  );

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  /** Shared by every fetch entry point (poll tick, manual refresh, resume, reconnect) so they
   *  coalesce onto one in-flight request instead of firing concurrent duplicate GETs — same
   *  single-flight idiom `authInterceptor` uses for token refresh. */
  private fetchInFlight: Promise<void> | null = null;

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly processingId = this._processingId.asReadonly();
  readonly actionError = this._actionError.asReadonly();
  readonly otpDialog = this._otpDialog.asReadonly();

  readonly groups = computed<AssignmentGroups>(() =>
    buildGroups(this._assignments()),
  );

  readonly activeAssignmentStatus = computed<ActiveAssignmentStatus>(() => {
    const hasActive = this.groups().active.length > 0;
    const source = this._activeAssignmentSource();

    if (hasActive) {
      return source === 'fresh' ? 'fresh' : 'stale';
    }
    if (this._error()) {
      return 'error';
    }
    return this.networkStatus.isOffline() ? 'offline' : 'empty';
  });

  /** The one order (if any) the customer app is currently able to show a live map for — see
   *  `OrderDetailsStore`/`live-tracking-map.component.ts`, which only render it once the order is
   *  `OUT_FOR_DELIVERY`. Sending GPS before that point would never reach a UI that displays it.
   *  Intentionally not gated on `activeAssignmentStatus` — a cache-restored active assignment
   *  that's genuinely `OUT_FOR_DELIVERY` is exactly the case worth resuming GPS for (e.g. the
   *  partner's phone restarted mid-delivery and just reconnected). */
  private readonly trackableOrderId = computed<string | null>(() => {
    const trackable = this.groups().active.find(
      (assignment) => assignment.order?.status === 'OUT_FOR_DELIVERY',
    );
    return trackable?.order?.id ?? null;
  });

  /** Whether this partner's device is currently able to send live location — surfaced so the page
   *  can tell them to enable location instead of the customer silently never seeing a moving pin. */
  readonly locationStatus = this.courierLocationService.status;

  constructor() {
    // Without this, a delivery partner who logs out while this page is mounted keeps polling
    // `getAssignments()` against an invalid session until the component happens to be destroyed.
    // The active-assignment cache is scoped per-device, not per-account (see class doc comment on
    // ActiveAssignmentCacheService) — clearing it on logout keeps a subsequent user of the same
    // device from seeing a previous partner's cached delivery.
    inject(LogoutCleanupRegistry).register(() => {
      this.stopPolling();
      void this.activeAssignmentCache.clear();
    });

    // Starts/stops sending live GPS as the active assignment enters/leaves OUT_FOR_DELIVERY —
    // AUDIT-016. `CourierLocationService.start` is itself a no-op if already tracking this exact
    // order, so this firing on every 15s assignment-poll tick doesn't restart the watch each time.
    effect(() => {
      const orderId = this.trackableOrderId();
      if (orderId) {
        void this.courierLocationService.start(orderId);
      } else {
        void this.courierLocationService.stop();
      }
    });

    // M3.8/M3.9 — app resume and network-reconnect both trigger a *controlled* revalidation
    // (silent, coalesced via `fetchInFlight`) only when the currently-shown data isn't already
    // confirmed fresh; mirrors DeliveryDashboardStore's existing onResume/'online' pattern exactly
    // rather than introducing a second lifecycle mechanism.
    this.mobilePlatform.onResume(() => this.revalidateIfNotFresh());
    window.addEventListener('online', () => this.revalidateIfNotFresh());
  }

  async loadAssignments(): Promise<void> {
    await this.fetchAssignments({ showLoading: true });
  }

  /** Loads immediately, then refreshes in the background on an interval. Safe to call more than once. */
  startPolling(intervalMs = POLL_INTERVAL_MS): void {
    if (this.pollHandle) {
      return;
    }

    void this.loadAssignments();
    this.pollHandle = setInterval(
      () => void this.refreshSilently(),
      intervalMs,
    );
  }

  stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private refreshSilently(): Promise<void> {
    return this.fetchAssignments({ showLoading: false });
  }

  private revalidateIfNotFresh(): void {
    if (this._activeAssignmentSource() === 'fresh') {
      return; // already confirmed current — an extra fetch here would just be noise
    }
    void this.refreshSilently();
  }

  /**
   * The single path every fetch trigger (poll tick, manual refresh, resume, reconnect) funnels
   * through — `fetchInFlight` ensures they coalesce onto one outstanding request rather than
   * firing concurrent duplicate GETs (M3.9). `showLoading` controls only the *foreground*
   * loading/error UI, matching `loadAssignments()`'s pre-M3 contract exactly; the underlying
   * fetch-and-cache-and-classify behavior is identical either way.
   */
  private fetchAssignments(options: { showLoading: boolean }): Promise<void> {
    if (this.fetchInFlight) {
      return this.fetchInFlight;
    }

    this.fetchInFlight = this.doFetchAssignments(options).finally(() => {
      this.fetchInFlight = null;
    });
    return this.fetchInFlight;
  }

  private async doFetchAssignments(options: {
    showLoading: boolean;
  }): Promise<void> {
    if (options.showLoading) {
      this._loading.set(true);
      this._error.set(null);
    }

    try {
      const assignments = await this.assignmentsService.getAssignments();
      this._assignments.set(assignments);
      this._error.set(null);
      this._activeAssignmentSource.set('fresh');
      await this.syncActiveAssignmentCache(assignments);
    } catch (error) {
      await this.handleFetchFailure(error, options.showLoading);
    } finally {
      if (options.showLoading) {
        this._loading.set(false);
      }
    }
  }

  /**
   * M3.6/M3.7: a failed fetch must never fabricate an error out of a cancellation, and must
   * preserve whatever useful data is already on screen (in-memory or cache-restored) rather than
   * blanking it — only a true cold start with nothing cached at all reaches the empty/error case.
   */
  private async handleFetchFailure(
    error: unknown,
    hadLoadingIndicator: boolean,
  ): Promise<void> {
    if (classifyNetworkError(error) === 'canceled') {
      return; // superseded by a newer request elsewhere — nothing to report
    }

    if (this._assignments().length > 0) {
      this._activeAssignmentSource.set('cache');
      return;
    }

    // M3.2: a cache read must never crash the application — `OfflineCache` itself already fails
    // safe, but this doesn't lean on that alone, in case a future/alternate cache implementation
    // doesn't uphold the same guarantee.
    const cached = await this.activeAssignmentCache.read().catch(() => null);
    if (cached) {
      this._assignments.set([cached.data]);
      this._activeAssignmentSource.set('cache');
      return;
    }

    this._activeAssignmentSource.set(null);
    // M3.4: offline-with-nothing-cached is its own explicit status (see `activeAssignmentStatus`),
    // not a generic error — only set the error message when something *other* than connectivity
    // is why nothing could be shown (a 5xx, an unexpected failure).
    if (hadLoadingIndicator && !this.networkStatus.isOffline()) {
      this._error.set('Unable to load your assignments. Please try again.');
    }
    // A silent background failure with nothing cached intentionally sets no `_error` — matches
    // the pre-M3 `refreshSilently` contract: a transient poll failure shouldn't blank the screen
    // into an error state the next successful tick would just clear again.
  }

  /**
   * M3.5's lifecycle rules in one place: written after any successful fetch or mutation that
   * changes whether an active assignment exists; cleared the moment the backend-confirmed state
   * has none. Always derives from the caller's own already-authoritative `assignments` snapshot —
   * never invents a transition the backend hasn't already confirmed.
   */
  private async syncActiveAssignmentCache(
    assignments: DeliveryAssignmentResponseDto[],
  ): Promise<void> {
    const active = buildGroups(assignments).active[0];
    if (active) {
      await this.activeAssignmentCache.write(active);
    } else {
      await this.activeAssignmentCache.clear();
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

    if (this.networkStatus.isOffline()) {
      this._otpDialog.set({
        ...dialog,
        generating: false,
        error: OFFLINE_MUTATION_MESSAGE,
      });
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
        error: extractHttpErrorMessage(
          error,
          'Unable to send a new code. Please try again.',
        ),
      });
    }
  }

  /** Verifies the code the partner entered. On success the order's status advances server-side (as a side effect of verification, not a separate call) and the dialog closes. */
  async verifyOtp(code: string): Promise<void> {
    const dialog = this._otpDialog();
    if (!dialog || dialog.verifying) {
      return;
    }

    if (this.networkStatus.isOffline()) {
      this._otpDialog.set({ ...dialog, error: OFFLINE_MUTATION_MESSAGE });
      return;
    }

    this._otpDialog.set({ ...dialog, verifying: true, error: null });

    try {
      const result =
        dialog.type === 'pickup'
          ? await this.assignmentsService.verifyPickupOtp(dialog.orderId, code)
          : await this.assignmentsService.verifyDeliveryOtp(
              dialog.orderId,
              code,
            );

      this.replaceAssignmentOrderStatus(
        dialog.assignmentId,
        result.orderStatus,
      );
      await this.syncActiveAssignmentCache(this._assignments());
      this._otpDialog.set(null);
    } catch (error) {
      const current = this._otpDialog();
      if (!current) {
        return;
      }
      this._otpDialog.set({
        ...current,
        verifying: false,
        error: extractHttpErrorMessage(
          error,
          'Unable to verify this code. Please try again.',
        ),
      });
    }
  }

  private async openOtpDialog(
    assignmentId: string,
    type: ProofType,
  ): Promise<void> {
    const assignment = this._assignments().find(
      (item) => item.id === assignmentId,
    );
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

  private replaceAssignmentOrderStatus(
    assignmentId: string,
    status: OrderResponseDto['status'],
  ): void {
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
   *
   * M3.10: this is the *only* mutation path in this store, and offline is checked before any
   * optimistic change or network call — there is no offline queue, and a mutation attempted while
   * offline is refused up front rather than attempted-and-rolled-back.
   */
  private async transitionAssignment(
    assignmentId: string,
    applyOptimistic: (
      assignment: DeliveryAssignmentResponseDto,
    ) => DeliveryAssignmentResponseDto,
    action: (original: DeliveryAssignmentResponseDto) => Promise<void>,
  ): Promise<void> {
    const original = this._assignments().find(
      (assignment) => assignment.id === assignmentId,
    );
    if (!original) {
      return;
    }

    if (this.networkStatus.isOffline()) {
      this._actionError.set(OFFLINE_MUTATION_MESSAGE);
      return;
    }

    this._processingId.set(assignmentId);
    this.replaceAssignment(assignmentId, applyOptimistic(original));

    try {
      await action(original);
      this._actionError.set(null);
      await this.syncActiveAssignmentCache(this._assignments());
    } catch {
      this.replaceAssignment(assignmentId, original);
      this._actionError.set(
        'Unable to update this assignment. Please try again.',
      );
    } finally {
      this._processingId.set(null);
    }
  }

  private replaceAssignment(
    assignmentId: string,
    replacement: DeliveryAssignmentResponseDto,
  ): void {
    this._assignments.update((assignments) =>
      assignments.map((assignment) =>
        assignment.id === assignmentId ? replacement : assignment,
      ),
    );
  }
}
