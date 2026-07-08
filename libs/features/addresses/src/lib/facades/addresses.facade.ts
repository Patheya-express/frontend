import { Injectable, inject } from '@angular/core';
import type { AddressResponseDto, CreateAddressDto, UpdateAddressDto } from '@patheya-express-frontend/api-sdk';
import { AddressesStore } from '../store/addresses.store';

@Injectable({ providedIn: 'root' })
export class AddressesFacade {
  private readonly store = inject(AddressesStore);

  readonly addresses = this.store.addresses;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly defaultAddress = this.store.defaultAddress;
  readonly selectedAddressId = this.store.selectedAddressId;
  readonly selectedAddress = this.store.selectedAddress;

  loadIfNeeded(): Promise<void> {
    return this.store.loadIfNeeded();
  }

  refresh(): Promise<void> {
    return this.store.refresh();
  }

  selectAddress(addressId: string): void {
    this.store.selectAddress(addressId);
  }

  create(dto: CreateAddressDto): Promise<AddressResponseDto | null> {
    return this.store.create(dto);
  }

  update(id: string, dto: UpdateAddressDto): Promise<AddressResponseDto | null> {
    return this.store.update(id, dto);
  }

  setDefault(id: string): Promise<void> {
    return this.store.setDefault(id);
  }

  remove(id: string): Promise<void> {
    return this.store.remove(id);
  }
}
