import { Injectable, inject } from '@angular/core';
import type { UpsertRestaurantSettingsDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantSettingsStore } from '../store/restaurant-settings.store';

@Injectable({ providedIn: 'root' })
export class RestaurantSettingsFacade {
  private readonly store = inject(RestaurantSettingsStore);

  readonly settings = this.store.settings;
  readonly loading = this.store.loading;
  readonly saving = this.store.saving;
  readonly error = this.store.error;
  readonly saveError = this.store.saveError;
  readonly savedAt = this.store.savedAt;

  initialize(): void {
    void this.store.load();
  }

  refresh(): void {
    void this.store.refresh();
  }

  save(dto: UpsertRestaurantSettingsDto): Promise<boolean> {
    return this.store.save(dto);
  }
}
