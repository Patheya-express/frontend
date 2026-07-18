import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type {
  PeakHourDto,
  RecentOrderSummaryDto,
  RestaurantDashboardResponseDto,
  TopSellingItemDto,
} from '@patheya-express-frontend/api-sdk';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { RealtimeSocketService, RestaurantContextService } from '@patheya-express-frontend/core';
import { RestaurantDashboardService } from '../services/restaurant-dashboard.service';

export interface DashboardMetric {
  key: string;
  label: string;
  value: string;
}

const POLL_INTERVAL_MS = 30_000;

/** Events pushed into the `restaurant:<id>` room that mean "the dashboard is now stale." */
const DASHBOARD_REFRESH_EVENTS = [
  'order.new',
  'order.cancelled',
  'order.refunded',
  'order.acceptance-timeout',
  'restaurant.settings.updated',
  'restaurant.hours.updated',
] as const;

/**
 * Every field is rendered as-received from the backend's dashboard aggregation endpoint — this
 * Store no longer derives metrics from a raw order list (see restaurant-dashboard.service.ts).
 */
function buildMetrics(dashboard: RestaurantDashboardResponseDto): DashboardMetric[] {
  return [
    { key: 'ordersToday', label: "Today's Orders", value: String(dashboard.ordersToday) },
    { key: 'revenueToday', label: 'Revenue Today', value: `₹${dashboard.revenueToday.toFixed(2)}` },
    { key: 'revenueThisWeek', label: 'Revenue This Week', value: `₹${dashboard.revenueThisWeek.toFixed(2)}` },
    { key: 'revenueThisMonth', label: 'Revenue This Month', value: `₹${dashboard.revenueThisMonth.toFixed(2)}` },
    { key: 'accepted', label: 'Accepted', value: String(dashboard.accepted) },
    { key: 'rejected', label: 'Rejected', value: String(dashboard.rejected) },
    { key: 'preparing', label: 'Preparing', value: String(dashboard.preparing) },
    { key: 'ready', label: 'Ready', value: String(dashboard.ready) },
    { key: 'completed', label: 'Completed', value: String(dashboard.completed) },
    {
      key: 'avgPrepTime',
      label: 'Avg. Preparation Time',
      value: dashboard.averagePreparationTimeMinutes != null ? `${dashboard.averagePreparationTimeMinutes} min` : '—',
    },
    { key: 'acceptanceRate', label: 'Acceptance Rate', value: `${dashboard.acceptanceRate}%` },
    { key: 'cancellationRate', label: 'Cancellation Rate', value: `${dashboard.cancellationRate}%` },
  ];
}

@Injectable({ providedIn: 'root' })
export class RestaurantDashboardStore {
  private readonly dashboardService = inject(RestaurantDashboardService);
  private readonly realtimeSocketService = inject(RealtimeSocketService);
  private readonly currentRestaurant = inject(RestaurantContextService);
  private readonly authFacade = inject(AuthFacade);

  private readonly _dashboard = signal<RestaurantDashboardResponseDto | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private unsubscribers: Array<() => void> = [];

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  /** True once the realtime socket is connected — the page can rely on push updates instead of polling. */
  readonly realtimeConnected = this.realtimeSocketService.connected;

  readonly metrics = computed<DashboardMetric[]>(() => {
    const dashboard = this._dashboard();
    return dashboard ? buildMetrics(dashboard) : [];
  });

  readonly topSellingItems = computed<TopSellingItemDto[]>(() => this._dashboard()?.topSellingItems ?? []);
  readonly peakHours = computed<PeakHourDto[]>(() =>
    [...(this._dashboard()?.peakHours ?? [])].sort((a, b) => b.orderCount - a.orderCount).slice(0, 5),
  );
  readonly recentOrders = computed<RecentOrderSummaryDto[]>(() => this._dashboard()?.recentOrders ?? []);

  constructor() {
    // Realtime is the primary channel; polling only runs as a fallback for when the socket is
    // unavailable — mirrors RestaurantOrdersStore/OrderDetailsStore.
    effect(() => {
      const connected = this.realtimeSocketService.connected();

      if (!this.started) {
        return;
      }

      if (connected) {
        this.stopPolling();
      } else {
        this.startPollingInterval();
      }
    });
  }

  async loadMetrics(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const dashboard = await this.dashboardService.getDashboard();
      this._dashboard.set(dashboard);
    } catch {
      this._error.set('Unable to load dashboard metrics. Please try again.');
      this._dashboard.set(null);
    } finally {
      this._loading.set(false);
    }
  }

  /** Loads immediately, joins the restaurant's realtime room for push-driven metric refresh,
   *  and falls back to polling only while the socket is disconnected. Safe to call more than once. */
  startSync(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    void this.loadMetrics();
    void this.joinRealtimeRooms();

    if (!this.realtimeSocketService.connected()) {
      this.startPollingInterval();
    }
  }

  stopSync(): void {
    this.stopPolling();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    this.started = false;
  }

  /** Joins both the restaurant-wide room (order/settings/hours events) and this staff member's
   *  own user room (personal `notification` events) — mirrors CustomerNotificationsStore. */
  private async joinRealtimeRooms(): Promise<void> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const userId = this.authFacade.user()?.id;

    const [restaurantJoined, userJoined] = await Promise.all([
      this.realtimeSocketService.joinRoom(`restaurant:${restaurantId}`),
      userId ? this.realtimeSocketService.joinRoom(`user:${userId}`) : Promise.resolve(false),
    ]);

    if (!this.started) {
      return;
    }

    if (restaurantJoined) {
      this.unsubscribers.push(
        ...DASHBOARD_REFRESH_EVENTS.map((event) =>
          this.realtimeSocketService.on(event, () => void this.refreshSilently()),
        ),
      );
    }

    if (userJoined) {
      this.unsubscribers.push(
        this.realtimeSocketService.on('notification', () => void this.refreshSilently()),
      );
    }
  }

  private startPollingInterval(): void {
    if (this.pollHandle) {
      return;
    }

    this.pollHandle = setInterval(() => void this.refreshSilently(), POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      const dashboard = await this.dashboardService.getDashboard();
      this._dashboard.set(dashboard);
      this._error.set(null);
    } catch {
      // A transient background refresh failure shouldn't blank out already-loaded metrics;
      // the next successful refresh recovers silently.
    }
  }
}
