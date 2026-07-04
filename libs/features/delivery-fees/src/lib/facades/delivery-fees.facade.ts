import { Injectable, inject } from '@angular/core';
import { DeliveryFeesStore } from '../store/delivery-fees.store';

@Injectable({ providedIn: 'root' })
export class DeliveryFeesFacade {
  private readonly store = inject(DeliveryFeesStore);

  readonly state = this.store.state;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  initialize(): Promise<void> {
    return this.store.loadHistory();
  }

  refresh(): Promise<void> {
    return this.store.loadHistory();
  }
}
