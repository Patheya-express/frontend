import { Injectable, inject } from '@angular/core';
import { DeliveryVerificationStore } from '../store/delivery-verification.store';

@Injectable({ providedIn: 'root' })
export class DeliveryVerificationFacade {
  private readonly store = inject(DeliveryVerificationStore);

  readonly verification = this.store.verification;
  readonly history = this.store.history;
  readonly onboarding = this.store.onboarding;
  readonly compliance = this.store.compliance;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly isApproved = this.store.isApproved;
  readonly isRejected = this.store.isRejected;
  readonly isSuspended = this.store.isSuspended;

  initialize(): void {
    void this.store.load();
  }

  refresh(): void {
    void this.store.refresh();
  }
}
