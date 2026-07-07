import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  AdminAlertDto,
  AdminDashboardMetricsDto,
  AdminDashboardResponseDto,
  AdminNotificationDto,
  HealthResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { AdminDashboardService } from '../services/admin-dashboard.service';

export interface DashboardMetric {
  key: string;
  label: string;
  value: string;
}

export type PlatformHealthStatus = 'healthy' | 'degraded' | 'unknown';

export interface AdminDashboardHealth {
  status: PlatformHealthStatus;
  raw: HealthResponseDto | null;
}

export interface AdminQuickAction {
  key: string;
  label: string;
  path: string;
}

export interface AdminDashboardState {
  metrics: DashboardMetric[];
  health: AdminDashboardHealth;
  quickActions: AdminQuickAction[];
}

const QUICK_ACTIONS: AdminQuickAction[] = [
  { key: 'users', label: 'Manage Users', path: '/users' },
  { key: 'restaurants', label: 'Restaurants', path: '/restaurants' },
  { key: 'orders', label: 'Orders', path: '/orders' },
  { key: 'delivery', label: 'Delivery', path: '/delivery' },
  { key: 'payments', label: 'Payments', path: '/payments' },
  { key: 'audit', label: 'Audit Logs', path: '/audit' },
];

function buildMetrics(metrics: AdminDashboardMetricsDto): DashboardMetric[] {
  return [
    { key: 'totalCustomers', label: 'Total Customers', value: String(metrics.totalCustomers) },
    { key: 'totalRestaurants', label: 'Total Restaurants', value: String(metrics.totalRestaurants) },
    {
      key: 'pendingRestaurantApprovals',
      label: 'Pending Restaurant Approvals',
      value: String(metrics.pendingRestaurantApprovals),
    },
    {
      key: 'activeDeliveryPartners',
      label: 'Active Delivery Partners',
      value: String(metrics.activeDeliveryPartners),
    },
    { key: 'ordersToday', label: 'Orders Today', value: String(metrics.ordersToday) },
    { key: 'activeOrders', label: 'Active Orders', value: String(metrics.activeOrders) },
    { key: 'completedOrdersToday', label: 'Completed Orders Today', value: String(metrics.completedOrdersToday) },
    { key: 'grossRevenueToday', label: 'Gross Revenue Today', value: `₹${metrics.grossRevenueToday.toFixed(2)}` },
  ];
}

/**
 * A platform is "healthy" only when every underlying dependency the /health check covers
 * (database, redis) is up, not just when the endpoint itself responded. The raw DTO is kept
 * as-is on the state (see AdminDashboardHealth.raw) — this only derives the display label.
 */
function deriveHealthStatus(health: HealthResponseDto | null): PlatformHealthStatus {
  if (!health) {
    return 'unknown';
  }

  return health.status === 'ok' && health.database === 'connected' && health.redis === 'connected'
    ? 'healthy'
    : 'degraded';
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardStore {
  private readonly dashboardService = inject(AdminDashboardService);

  private readonly _dashboard = signal<AdminDashboardResponseDto | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly alerts = computed<AdminAlertDto[]>(() => this._dashboard()?.alerts ?? []);
  readonly notifications = computed<AdminNotificationDto[]>(() => this._dashboard()?.notifications ?? []);

  readonly state = computed<AdminDashboardState>(() => {
    const dashboard = this._dashboard();
    const health = dashboard?.health ?? null;

    return {
      metrics: dashboard ? buildMetrics(dashboard.metrics) : [],
      health: {
        status: deriveHealthStatus(health),
        raw: health,
      },
      quickActions: QUICK_ACTIONS,
    };
  });

  async loadDashboard(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const dashboard = await this.dashboardService.getDashboard();
      this._dashboard.set(dashboard);
    } catch {
      this._error.set('Unable to load dashboard data. Please try again.');
      this._dashboard.set(null);
    } finally {
      this._loading.set(false);
    }
  }
}
