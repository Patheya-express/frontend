import { Injectable, inject } from '@angular/core';
import type { CreateVehicleDto, UpdateVehicleDto } from '@patheya-express-frontend/api-sdk';
import { DeliveryVehiclesStore } from '../store/delivery-vehicles.store';

@Injectable({ providedIn: 'root' })
export class DeliveryVehiclesFacade {
  private readonly store = inject(DeliveryVehiclesStore);

  readonly vehicles = this.store.vehicles;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly saving = this.store.saving;
  readonly saveError = this.store.saveError;
  readonly pendingVehicleId = this.store.pendingVehicleId;
  readonly primaryVehicle = this.store.primaryVehicle;
  readonly vehiclesWithWarnings = this.store.vehiclesWithWarnings;

  initialize(): void {
    void this.store.load();
  }

  refresh(): void {
    void this.store.refresh();
  }

  create(dto: CreateVehicleDto): Promise<boolean> {
    return this.store.create(dto);
  }

  update(vehicleId: string, dto: UpdateVehicleDto): Promise<boolean> {
    return this.store.update(vehicleId, dto);
  }

  setPrimary(vehicleId: string): Promise<boolean> {
    return this.store.setPrimary(vehicleId);
  }

  deactivate(vehicleId: string): Promise<boolean> {
    return this.store.deactivate(vehicleId);
  }
}
