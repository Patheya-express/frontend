import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  AssignmentOrderSummaryDto,
  DeliveryAssignmentResponseDto,
  DeliveryPartnerResponseDto,
  OrderResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { MobilePlatformService } from '@patheya-express-frontend/core';
import { formatCurrency } from '@patheya-express-frontend/ui';
import { DeliveryDashboardService } from '../services/delivery-dashboard.service';

export interface DashboardMetric {
  key: string;
  label: string;
  value: string;
}

const ACTIVE_ORDER_STATUSES: ReadonlyArray<OrderResponseDto['status']> = ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'];

/**
 * Presence Heartbeat Hardening — how often the online-status Redis TTL (120s server-side, see
 * PresenceService.PRESENCE_TTL_SECONDS on the backend) gets refreshed while a partner is online.
 * A plain module constant, not a runtime env var: this is a compiled Angular bundle, not a
 * server process reading process.env — the equivalent "configurable, no magic number" convention
 * here is one named, documented constant rather than a literal buried in the interval call.
 */
const DELIVERY_PRESENCE_HEARTBEAT_SECONDS = 60;

function isToday(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  );
}

function buildMetrics(orders: OrderResponseDto[], pendingAssignmentsCount: number): DashboardMetric[] {
  const deliveredToday = orders.filter(
    (order) => order.status === 'DELIVERED' && !!order.deliveredAt && isToday(order.deliveredAt),
  );
  const feesToday = deliveredToday.reduce((sum, order) => sum + Number(order.deliveryFee), 0);

  return [
    { key: 'availableAssignments', label: 'Available Assignments', value: String(pendingAssignmentsCount) },
    { key: 'completedToday', label: 'Completed Deliveries Today', value: String(deliveredToday.length) },
    // Sum of delivery fees, not a final payout — no commission/earnings model exists yet.
    { key: 'feesToday', label: 'Delivery Fees Today (Estimated)', value: formatCurrency(feesToday) },
  ];
}

@Injectable({ providedIn: 'root' })
export class DeliveryDashboardStore {
  private readonly dashboardService = inject(DeliveryDashboardService);
  private readonly mobilePlatform = inject(MobilePlatformService);

  private heartbeatHandle: ReturnType<typeof setInterval> | null = null;

  private readonly _partner = signal<DeliveryPartnerResponseDto | null>(null);
  private readonly _orders = signal<OrderResponseDto[]>([]);
  private readonly _assignments = signal<DeliveryAssignmentResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _statusActionPending = signal(false);

  readonly partner = this._partner.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly statusActionPending = this._statusActionPending.asReadonly();

  /**
   * Presence Heartbeat Hardening. Registered once, for the app's whole lifetime — this store is
   * `providedIn: 'root'` (never destroyed), matching DeliveryAssignmentsStore's exact
   * LogoutCleanupRegistry pattern immediately below.
   */
  constructor() {
    inject(LogoutCleanupRegistry).register(() => this.stopHeartbeat());

    // Change 4 (app lifecycle): native app foreground. `MobilePlatformService.onResume` keeps
    // the `@capacitor/app` plugin import confined to shared/core (this workspace's existing
    // convention), rather than this feature lib depending on it directly; it's already a no-op
    // on web, so no separate isNative() guard is needed here.
    this.mobilePlatform.onResume(() => this.onLifecycleResume('presence_app_resumed'));

    // Change 4 (network resilience): browser/WebView network reconnect — works identically on
    // web and inside the Capacitor WebView, no extra native plugin dependency needed.
    window.addEventListener('online', () => this.onLifecycleResume('presence_network_reconnected'));
  }

  readonly isOnline = computed(() => this._partner()?.status === 'AVAILABLE');

  private readonly pendingAssignmentsCount = computed(
    () => this._assignments().filter((assignment) => assignment.status === 'PENDING').length,
  );

  /** The accepted assignment whose order hasn't reached a terminal state yet, if any. */
  readonly currentAssignment = computed<AssignmentOrderSummaryDto | null>(() => {
    const active = this._assignments().find(
      (assignment) =>
        assignment.status === 'ACCEPTED' &&
        !!assignment.order &&
        ACTIVE_ORDER_STATUSES.includes(assignment.order.status),
    );
    return active?.order ?? null;
  });

  readonly metrics = computed(() => buildMetrics(this._orders(), this.pendingAssignmentsCount()));

  async loadDashboard(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const [partner, orders, assignments] = await Promise.all([
        this.dashboardService.getPartner(),
        this.dashboardService.getAssignedOrders(),
        this.dashboardService.getMyAssignments(),
      ]);

      this._partner.set(partner);
      this._orders.set(orders);
      this._assignments.set(assignments);

      // Presence Heartbeat Hardening — "survives long sessions/app resume": a full app relaunch
      // or page reload loses this store's in-memory heartbeatHandle even though the partner is
      // still AVAILABLE server-side. Without this, going online, then closing and reopening the
      // app, would silently leave presence un-refreshed until the partner explicitly toggles
      // offline/online again. startHeartbeat() is idempotent, so this is a no-op if a heartbeat
      // is already running.
      if (partner.status === 'AVAILABLE') {
        this.startHeartbeat();
      }
    } catch {
      this._error.set('Unable to load your dashboard. Make sure you have completed delivery partner registration.');
    } finally {
      this._loading.set(false);
    }
  }

  goOnline(): Promise<void> {
    return this.toggleStatus(
      () => this.dashboardService.goOnline(),
      () => this.startHeartbeat(),
    );
  }

  goOffline(): Promise<void> {
    return this.toggleStatus(
      () => this.dashboardService.goOffline(),
      () => this.stopHeartbeat(),
    );
  }

  private async toggleStatus(
    action: () => Promise<DeliveryPartnerResponseDto>,
    onSuccess: () => void,
  ): Promise<void> {
    this._statusActionPending.set(true);
    this._error.set(null);

    try {
      const partner = await action();
      this._partner.set(partner);
      onSuccess();
    } catch {
      this._error.set('Unable to update your status. Please try again.');
    } finally {
      this._statusActionPending.set(false);
    }
  }

  /**
   * Change 1 + Change 6 (heartbeat + duplicate protection). Idempotent — safe to call from
   * goOnline(), loadDashboard() finding an already-online partner, or anywhere else; a second
   * call while a heartbeat is already running is a guaranteed no-op, so there is never more than
   * one interval in flight no matter how many of those call sites fire.
   */
  private startHeartbeat(intervalSeconds = DELIVERY_PRESENCE_HEARTBEAT_SECONDS): void {
    if (this.heartbeatHandle) {
      return;
    }

    this.logHeartbeatEvent('presence_heartbeat_started', { intervalSeconds });

    this.heartbeatHandle = setInterval(() => void this.sendHeartbeat(), intervalSeconds * 1000);
  }

  /** Change 2 (stop heartbeat) + Change 3 (logout cleanup calls this directly). Idempotent. */
  private stopHeartbeat(): void {
    if (!this.heartbeatHandle) {
      return;
    }

    clearInterval(this.heartbeatHandle);
    this.heartbeatHandle = null;
    this.logHeartbeatEvent('presence_heartbeat_stopped');
  }

  /**
   * Change 5 (network resilience): a failed ping is logged and otherwise ignored — it never
   * flips the driver offline (that would defeat the entire point of a resilient heartbeat) and
   * never triggers an immediate retry or backoff schedule. The next regular interval tick (or the
   * next app-resume/network-reconnect event) tries again on its own; a single transient failure
   * is exactly that, transient.
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      await this.dashboardService.pingOnline();
      this.logHeartbeatEvent('presence_heartbeat_sent');
    } catch (error) {
      this.logHeartbeatEvent('presence_heartbeat_failed', { reason: String(error) }, 'warn');
    }
  }

  /**
   * Change 4 (app lifecycle). Shared by both the native `resume` listener and the browser
   * `online` listener — an out-of-band, immediate re-ping on top of (not a replacement for) the
   * regular interval, so a partner who was backgrounded/offline for longer than the 120s Redis
   * TTL doesn't have to wait for the next scheduled tick once they're back. A no-op while the
   * driver isn't currently online (no heartbeat running) — there is nothing to refresh, and this
   * must never be what starts a heartbeat on its own.
   */
  private onLifecycleResume(event: 'presence_app_resumed' | 'presence_network_reconnected'): void {
    if (!this.heartbeatHandle) {
      return;
    }

    this.logHeartbeatEvent(event);
    void this.sendHeartbeat();
  }

  /** Change 7 (observability). No structured-logging service exists on this frontend today (only
   *  UI-facing error signals) — a plain console call with the exact required fields is the
   *  minimal way to satisfy this without inventing new logging infrastructure. */
  private logHeartbeatEvent(
    event: string,
    extra?: Record<string, unknown>,
    level: 'info' | 'warn' = 'info',
  ): void {
    const partner = this._partner();

    const payload = {
      event,
      userId: partner?.userId,
      deliveryPartnerId: partner?.id,
      ...extra,
    };

    if (level === 'warn') {
      console.warn(payload);
    } else {
      console.info(payload);
    }
  }
}
