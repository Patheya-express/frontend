import { Injectable, inject } from '@angular/core';
import { DeliveryComplianceStore } from '../store/delivery-compliance.store';

@Injectable({ providedIn: 'root' })
export class DeliveryComplianceFacade {
  private readonly store = inject(DeliveryComplianceStore);

  readonly snapshot = this.store.snapshot;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  initialize(): void {
    void this.store.load();
  }

  refresh(): void {
    void this.store.refresh();
  }
}
