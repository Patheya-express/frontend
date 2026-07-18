import { Injectable, inject, signal } from '@angular/core';
import type { DeliveryProfileResponseDto, UpdateDeliveryProfileDto } from '@patheya-express-frontend/api-sdk';
import { CurrentDeliveryPartnerService } from '@patheya-express-frontend/core';
import { DeliveryProfileFeatureService } from '../services/delivery-profile.service';

@Injectable({ providedIn: 'root' })
export class DeliveryProfileStore {
  private readonly service = inject(DeliveryProfileFeatureService);
  private readonly currentDeliveryPartnerService = inject(CurrentDeliveryPartnerService);

  private readonly _profile = signal<DeliveryProfileResponseDto | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _saving = signal(false);
  private readonly _saveError = signal<string | null>(null);

  readonly profile = this._profile.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly saveError = this._saveError.asReadonly();

  private loadPromise: Promise<void> | null = null;

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
      const profile = await this.service.getMyProfile();
      this._profile.set(profile);
    } catch {
      this._error.set('Unable to load your profile. Please refresh and try again.');
    } finally {
      this._loading.set(false);
    }
  }

  async update(dto: UpdateDeliveryProfileDto): Promise<boolean> {
    this._saving.set(true);
    this._saveError.set(null);
    try {
      const profile = await this.service.updateMyProfile(dto);
      this._profile.set(profile);
      this.currentDeliveryPartnerService.invalidate();
      return true;
    } catch {
      this._saveError.set('Unable to save your profile. Please check the form and try again.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }
}
