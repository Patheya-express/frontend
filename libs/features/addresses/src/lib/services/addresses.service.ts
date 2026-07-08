import { Injectable, inject } from '@angular/core';
import {
  AddressesService as AddressesApiService,
  type AddressResponseDto,
  type CreateAddressDto,
  type UpdateAddressDto,
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
export class AddressesService {
  private readonly addressesApi = inject(AddressesApiService);

  async findAll(): Promise<AddressResponseDto[]> {
    const response = await this.addressesApi.addressesControllerFindAll();
    return unwrap(response);
  }

  async create(dto: CreateAddressDto): Promise<AddressResponseDto> {
    const response = await this.addressesApi.addressesControllerCreate({ body: dto });
    return unwrap(response);
  }

  async update(id: string, dto: UpdateAddressDto): Promise<AddressResponseDto> {
    const response = await this.addressesApi.addressesControllerUpdate({ id, body: dto });
    return unwrap(response);
  }

  async setDefault(id: string): Promise<AddressResponseDto> {
    const response = await this.addressesApi.addressesControllerSetDefault({ id });
    return unwrap(response);
  }

  async remove(id: string): Promise<void> {
    await this.addressesApi.addressesControllerRemove({ id });
  }
}
