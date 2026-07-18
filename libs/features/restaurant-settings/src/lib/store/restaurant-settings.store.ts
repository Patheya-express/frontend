import { Injectable, inject, signal } from '@angular/core';
import type {
  RestaurantSettingsResponseDto,
  UpsertRestaurantSettingsDto,
} from '@patheya-express-frontend/api-sdk';
import { RestaurantSettingsFeatureService } from '../services/restaurant-settings.service';

@Injectable({ providedIn: 'root' })
export class RestaurantSettingsStore {
  private readonly service = inject(RestaurantSettingsFeatureService);

  private readonly _settings = signal<RestaurantSettingsResponseDto | null>(null);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _saveError = signal<string | null>(null);
  private readonly _savedAt = signal<Date | null>(null);

  readonly settings = this._settings.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly saveError = this._saveError.asReadonly();
  readonly savedAt = this._savedAt.asReadonly();

  private loadPromise: Promise<void> | null = null;

  /** Loads once and caches — both Settings pages share the same underlying row, so opening
   *  either one after the other shouldn't re-fetch. */
  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.fetch();
    }

    return this.loadPromise;
  }

  refresh(): Promise<void> {
    this.loadPromise = this.fetch();
    return this.loadPromise;
  }

  private async fetch(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const settings = await this.service.getSettings();
      this._settings.set(settings);
    } catch {
      this._error.set('Unable to load restaurant settings. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  async save(dto: UpsertRestaurantSettingsDto): Promise<boolean> {
    this._saving.set(true);
    this._saveError.set(null);

    try {
      const settings = await this.service.upsertSettings(dto);
      this._settings.set(settings);
      this._savedAt.set(new Date());
      return true;
    } catch {
      this._saveError.set('Unable to save settings. Please try again.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }
}
