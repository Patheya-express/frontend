import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import type { AddressResponseDto } from '@patheya-express-frontend/api-sdk';
import { AddressesFacade } from '../../facades/addresses.facade';
import { AddressCardComponent } from '../address-card/address-card.component';
import { AddressFormComponent } from '../address-form/address-form.component';

@Component({
  selector: 'lib-address-picker',
  standalone: true,
  imports: [AddressCardComponent, AddressFormComponent],
  templateUrl: './address-picker.component.html',
  styleUrl: './address-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressPickerComponent implements OnInit {
  private readonly addressesFacade = inject(AddressesFacade);

  protected readonly addresses = this.addressesFacade.addresses;
  protected readonly loading = this.addressesFacade.loading;
  protected readonly error = this.addressesFacade.error;
  protected readonly selectedAddressId = this.addressesFacade.selectedAddressId;

  protected readonly showAddForm = signal(false);
  protected readonly editingAddress = signal<AddressResponseDto | null>(null);

  ngOnInit(): void {
    void this.addressesFacade.loadIfNeeded();
  }

  protected select(addressId: string): void {
    this.addressesFacade.selectAddress(addressId);
  }

  protected startAdd(): void {
    this.editingAddress.set(null);
    this.showAddForm.set(true);
  }

  protected startEdit(addressId: string): void {
    const address = this.addresses().find((a) => a.id === addressId) ?? null;
    this.editingAddress.set(address);
    this.showAddForm.set(true);
  }

  protected onSaved(address: AddressResponseDto): void {
    this.showAddForm.set(false);
    this.editingAddress.set(null);
    this.addressesFacade.selectAddress(address.id);
  }

  protected onCancelled(): void {
    this.showAddForm.set(false);
    this.editingAddress.set(null);
  }

  protected setDefault(addressId: string): void {
    void this.addressesFacade.setDefault(addressId);
  }

  protected remove(addressId: string): void {
    void this.addressesFacade.remove(addressId);
  }
}
