import { Injectable, inject, signal } from '@angular/core';
import type { DeliveryComplianceResponseDto } from '@patheya-express-frontend/api-sdk';
import { DeliveryComplianceFeatureService } from '../services/delivery-compliance.service';

@Injectable({ providedIn: 'root' })
export class DeliveryComplianceStore {
  private readonly service = inject(DeliveryComplianceFeatureService);

  private readonly _snapshot = signal<DeliveryComplianceResponseDto | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly snapshot = this._snapshot.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

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
      const snapshot = await this.service.getSnapshot();
      this._snapshot.set(snapshot);
    } catch {
      this._error.set('Unable to load your compliance snapshot. Please refresh and try again.');
    } finally {
      this._loading.set(false);
    }
  }
}
