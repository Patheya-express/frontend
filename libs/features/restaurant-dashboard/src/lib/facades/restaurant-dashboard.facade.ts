import { Injectable, inject } from '@angular/core';
import { RestaurantDashboardStore } from '../store/restaurant-dashboard.store';

@Injectable({ providedIn: 'root' })
export class RestaurantDashboardFacade {
  private readonly store = inject(RestaurantDashboardStore);

  readonly metrics = this.store.metrics;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  initialize(): Promise<void> {
    return this.store.loadMetrics();
  }

  refresh(): Promise<void> {
    return this.store.loadMetrics();
  }
}
