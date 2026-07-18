import { Injectable, inject } from '@angular/core';
import {
  DeliveryVehiclesService as DeliveryVehiclesSdkService,
  type CreateVehicleDto,
  type UpdateVehicleDto,
  type VehicleResponseDto,
} from '@patheya-express-frontend/api-sdk';

// The API gateway wraps every response in a { success, timestamp, data } envelope via a
// global interceptor that Swagger/the generated SDK types do not account for.
interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

@Injectable({ providedIn: 'root' })
export class DeliveryVehiclesFeatureService {
  private readonly vehiclesService = inject(DeliveryVehiclesSdkService);

  async list(): Promise<VehicleResponseDto[]> {
    const response = await this.vehiclesService.vehiclesControllerList();
    return unwrap(response);
  }

  async create(dto: CreateVehicleDto): Promise<VehicleResponseDto> {
    const response = await this.vehiclesService.vehiclesControllerCreate({ body: dto });
    return unwrap(response);
  }

  async update(vehicleId: string, dto: UpdateVehicleDto): Promise<VehicleResponseDto> {
    const response = await this.vehiclesService.vehiclesControllerUpdate({ vehicleId, body: dto });
    return unwrap(response);
  }

  async setPrimary(vehicleId: string): Promise<VehicleResponseDto> {
    const response = await this.vehiclesService.vehiclesControllerSetPrimary({ vehicleId });
    return unwrap(response);
  }

  async deactivate(vehicleId: string): Promise<VehicleResponseDto> {
    const response = await this.vehiclesService.vehiclesControllerDeactivate({ vehicleId });
    return unwrap(response);
  }
}
