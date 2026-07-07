import { Injectable, inject } from '@angular/core';
import { AdminDashboardStore } from '../store/admin-dashboard.store';

@Injectable({ providedIn: 'root' })
export class AdminDashboardFacade {
  private readonly store = inject(AdminDashboardStore);

  readonly state = this.store.state;
  readonly alerts = this.store.alerts;
  readonly notifications = this.store.notifications;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  /** Loads dashboard data. Call once on page init. */
  initialize(): Promise<void> {
    return this.store.loadDashboard();
  }

  refresh(): Promise<void> {
    return this.store.loadDashboard();
  }
}
