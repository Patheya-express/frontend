import { Injectable, computed, inject, signal } from '@angular/core';
import type { AddressResponseDto, CreateAddressDto, UpdateAddressDto } from '@patheya-express-frontend/api-sdk';
import { AddressesService } from '../services/addresses.service';

@Injectable({ providedIn: 'root' })
export class AddressesStore {
  private readonly addressesService = inject(AddressesService);

  private readonly _addresses = signal<AddressResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _selectedAddressId = signal<string | null>(null);
  private loaded = false;

  readonly addresses = this._addresses.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly defaultAddress = computed(() => this._addresses().find((address) => address.isDefault) ?? null);

  readonly selectedAddressId = computed(() => this._selectedAddressId() ?? this.defaultAddress()?.id ?? null);

  readonly selectedAddress = computed(
    () => this._addresses().find((address) => address.id === this.selectedAddressId()) ?? null,
  );

  /** Loads the address list once; call refresh() to force a reload after a mutation elsewhere. */
  async loadIfNeeded(): Promise<void> {
    if (this.loaded) {
      return;
    }
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const addresses = await this.addressesService.findAll();
      this._addresses.set(addresses);
      this.loaded = true;
    } catch {
      this._error.set('Unable to load your saved addresses.');
    } finally {
      this._loading.set(false);
    }
  }

  selectAddress(addressId: string): void {
    this._selectedAddressId.set(addressId);
  }

  async create(dto: CreateAddressDto): Promise<AddressResponseDto | null> {
    this._error.set(null);

    try {
      const address = await this.addressesService.create(dto);
      await this.refresh();
      this._selectedAddressId.set(address.id);
      return address;
    } catch {
      this._error.set('Unable to save this address.');
      return null;
    }
  }

  async update(id: string, dto: UpdateAddressDto): Promise<AddressResponseDto | null> {
    this._error.set(null);

    try {
      const address = await this.addressesService.update(id, dto);
      await this.refresh();
      return address;
    } catch {
      this._error.set('Unable to update this address.');
      return null;
    }
  }

  async setDefault(id: string): Promise<void> {
    this._error.set(null);

    try {
      await this.addressesService.setDefault(id);
      await this.refresh();
    } catch {
      this._error.set('Unable to set this address as default.');
    }
  }

  async remove(id: string): Promise<void> {
    this._error.set(null);

    try {
      await this.addressesService.remove(id);

      if (this._selectedAddressId() === id) {
        this._selectedAddressId.set(null);
      }

      await this.refresh();
    } catch {
      this._error.set('Unable to delete this address.');
    }
  }
}
