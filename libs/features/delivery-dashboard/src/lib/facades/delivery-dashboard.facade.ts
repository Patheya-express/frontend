import { Injectable, inject } from '@angular/core';
import { DeliveryDashboardStore } from '../store/delivery-dashboard.store';

@Injectable({ providedIn: 'root' })
export class DeliveryDashboardFacade {
  private readonly store = inject(DeliveryDashboardStore);

  readonly partner = this.store.partner;
  readonly isOnline = this.store.isOnline;
  readonly currentAssignment = this.store.currentAssignment;
  readonly metrics = this.store.metrics;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly statusActionPending = this.store.statusActionPending;

  initialize(): Promise<void> {
    return this.store.loadDashboard();
  }

  refresh(): Promise<void> {
    return this.store.loadDashboard();
  }

  goOnline(): Promise<void> {
    return this.store.goOnline();
  }

  goOffline(): Promise<void> {
    return this.store.goOffline();
  }
}
