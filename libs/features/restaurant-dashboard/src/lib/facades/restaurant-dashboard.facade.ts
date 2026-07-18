import { Injectable, inject } from '@angular/core';
import { RestaurantDashboardStore } from '../store/restaurant-dashboard.store';

@Injectable({ providedIn: 'root' })
export class RestaurantDashboardFacade {
  private readonly store = inject(RestaurantDashboardStore);

  readonly metrics = this.store.metrics;
  readonly topSellingItems = this.store.topSellingItems;
  readonly peakHours = this.store.peakHours;
  readonly recentOrders = this.store.recentOrders;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  /** True once the realtime socket is connected — used to show a live/reconnecting indicator. */
  readonly realtimeConnected = this.store.realtimeConnected;

  /** Loads metrics, joins the restaurant's realtime room, and falls back to polling only while
   *  disconnected. Call once on page init. */
  initialize(): void {
    this.store.startSync();
  }

  /** Stops realtime subscriptions and any fallback polling. Call on page destroy. */
  dispose(): void {
    this.store.stopSync();
  }

  refresh(): Promise<void> {
    return this.store.loadMetrics();
  }
}
