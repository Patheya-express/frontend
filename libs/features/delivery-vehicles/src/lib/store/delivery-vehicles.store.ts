import { Injectable, computed, inject, signal } from '@angular/core';
import type { CreateVehicleDto, UpdateVehicleDto, VehicleResponseDto } from '@patheya-express-frontend/api-sdk';
import { DeliveryVehiclesFeatureService } from '../services/delivery-vehicles.service';

const EXPIRY_WARNING_WINDOW_DAYS = 30;

function isExpiringOrExpired(dateIso: string | undefined): 'expired' | 'expiring' | null {
  if (!dateIso) {
    return null;
  }
  const now = Date.now();
  const expiry = new Date(dateIso).getTime();
  if (expiry < now) {
    return 'expired';
  }
  if (expiry - now <= EXPIRY_WARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    return 'expiring';
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class DeliveryVehiclesStore {
  private readonly service = inject(DeliveryVehiclesFeatureService);

  private readonly _vehicles = signal<VehicleResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _saving = signal(false);
  private readonly _saveError = signal<string | null>(null);
  private readonly _pendingVehicleId = signal<string | null>(null);

  readonly vehicles = this._vehicles.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly saveError = this._saveError.asReadonly();
  readonly pendingVehicleId = this._pendingVehicleId.asReadonly();

  readonly primaryVehicle = computed(() => this._vehicles().find((v) => v.isPrimary) ?? null);

  readonly vehiclesWithWarnings = computed(() =>
    this._vehicles().map((vehicle) => ({
      vehicle,
      insurance: isExpiringOrExpired(vehicle.insuranceExpiryAt),
      rc: isExpiringOrExpired(vehicle.rcExpiryAt),
      fitness: isExpiringOrExpired(vehicle.fitnessExpiryAt),
      pollution: isExpiringOrExpired(vehicle.pollutionExpiryAt),
    })),
  );

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
      const vehicles = await this.service.list();
      this._vehicles.set(vehicles);
    } catch {
      this._error.set('Unable to load your vehicles. Please refresh and try again.');
    } finally {
      this._loading.set(false);
    }
  }

  async create(dto: CreateVehicleDto): Promise<boolean> {
    return this.withSaving(null, async () => {
      const vehicle = await this.service.create(dto);
      this._vehicles.update((existing) => [...existing, vehicle]);
    });
  }

  async update(vehicleId: string, dto: UpdateVehicleDto): Promise<boolean> {
    return this.withSaving(vehicleId, async () => {
      const vehicle = await this.service.update(vehicleId, dto);
      this._vehicles.update((existing) => existing.map((v) => (v.id === vehicleId ? vehicle : v)));
    });
  }

  async setPrimary(vehicleId: string): Promise<boolean> {
    return this.withSaving(vehicleId, async () => {
      await this.service.setPrimary(vehicleId);
      await this.refresh();
    });
  }

  async deactivate(vehicleId: string): Promise<boolean> {
    return this.withSaving(vehicleId, async () => {
      const vehicle = await this.service.deactivate(vehicleId);
      this._vehicles.update((existing) => existing.map((v) => (v.id === vehicleId ? vehicle : v)));
    });
  }

  private async withSaving(vehicleId: string | null, action: () => Promise<void>): Promise<boolean> {
    this._saving.set(true);
    this._saveError.set(null);
    this._pendingVehicleId.set(vehicleId);
    try {
      await action();
      return true;
    } catch {
      this._saveError.set('Unable to save this vehicle. Please check the form and try again.');
      return false;
    } finally {
      this._saving.set(false);
      this._pendingVehicleId.set(null);
    }
  }
}
