import { Injectable, computed, inject, signal } from '@angular/core';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantDashboardService } from '../services/restaurant-dashboard.service';

export interface DashboardMetric {
  key: string;
  label: string;
  value: string;
}

const ACTIVE_STATUSES: ReadonlyArray<OrderResponseDto['status']> = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
];

function isToday(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  );
}

/**
 * Builds the metric list from the raw order array. Returning a list (rather than fixed
 * fields) is what lets the page render metrics generically — adding a metric later means
 * adding an entry here, not changing the page template.
 */
function buildMetrics(orders: OrderResponseDto[]): DashboardMetric[] {
  const deliveredToday = orders.filter((order) => order.status === 'DELIVERED' && !!order.deliveredAt && isToday(order.deliveredAt));
  const revenueToday = deliveredToday.reduce((sum, order) => sum + Number(order.totalAmount), 0);

  return [
    { key: 'active', label: 'Active Orders', value: String(orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length) },
    { key: 'pending', label: 'Pending Orders', value: String(orders.filter((o) => o.status === 'PENDING').length) },
    { key: 'preparing', label: 'Preparing Orders', value: String(orders.filter((o) => o.status === 'PREPARING').length) },
    { key: 'ready', label: 'Ready Orders', value: String(orders.filter((o) => o.status === 'READY_FOR_PICKUP').length) },
    { key: 'completedToday', label: 'Completed Today', value: String(deliveredToday.length) },
    { key: 'revenueToday', label: 'Revenue Today', value: `₹${revenueToday.toFixed(2)}` },
  ];
}

@Injectable({ providedIn: 'root' })
export class RestaurantDashboardStore {
  private readonly dashboardService = inject(RestaurantDashboardService);

  private readonly _orders = signal<OrderResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly metrics = computed(() => buildMetrics(this._orders()));

  async loadMetrics(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const orders = await this.dashboardService.getRestaurantOrders();
      this._orders.set(orders);
    } catch {
      this._error.set('Unable to load dashboard metrics. Please try again.');
      this._orders.set([]);
    } finally {
      this._loading.set(false);
    }
  }
}
