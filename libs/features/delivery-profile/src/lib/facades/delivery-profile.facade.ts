import { Injectable, inject } from '@angular/core';
import type { UpdateDeliveryProfileDto } from '@patheya-express-frontend/api-sdk';
import { DeliveryProfileStore } from '../store/delivery-profile.store';

@Injectable({ providedIn: 'root' })
export class DeliveryProfileFacade {
  private readonly store = inject(DeliveryProfileStore);

  readonly profile = this.store.profile;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly saving = this.store.saving;
  readonly saveError = this.store.saveError;

  initialize(): void {
    void this.store.load();
  }

  refresh(): void {
    void this.store.refresh();
  }

  update(dto: UpdateDeliveryProfileDto): Promise<boolean> {
    return this.store.update(dto);
  }
}
