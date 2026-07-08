import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import type { AddressResponseDto, CreateAddressDto, UpdateAddressDto } from '@patheya-express-frontend/api-sdk';
import { AddressesFacade } from '../../facades/addresses.facade';

type AddressLabel = 'HOME' | 'WORK' | 'OTHER';

@Component({
  selector: 'lib-address-form',
  standalone: true,
  templateUrl: './address-form.component.html',
  styleUrl: './address-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressFormComponent {
  private readonly addressesFacade = inject(AddressesFacade);

  @Input() address: AddressResponseDto | null = null;
  @Output() saved = new EventEmitter<AddressResponseDto>();
  @Output() cancelled = new EventEmitter<void>();

  protected readonly labels: AddressLabel[] = ['HOME', 'WORK', 'OTHER'];

  protected readonly label = signal<AddressLabel>('HOME');
  protected readonly customLabel = signal('');
  protected readonly addressLine1 = signal('');
  protected readonly addressLine2 = signal('');
  protected readonly city = signal('');
  protected readonly state = signal('');
  protected readonly postalCode = signal('');
  protected readonly landmark = signal('');
  protected readonly deliveryInstructions = signal('');
  protected readonly isDefault = signal(false);
  protected readonly latitude = signal<number | undefined>(undefined);
  protected readonly longitude = signal<number | undefined>(undefined);

  protected readonly saving = signal(false);
  protected readonly locating = signal(false);
  protected readonly formError = signal<string | null>(null);

  constructor() {
    if (this.address) {
      const a = this.address;
      this.label.set(a.label);
      this.customLabel.set(a.customLabel ?? '');
      this.addressLine1.set(a.addressLine1);
      this.addressLine2.set(a.addressLine2 ?? '');
      this.city.set(a.city);
      this.state.set(a.state);
      this.postalCode.set(a.postalCode);
      this.landmark.set(a.landmark ?? '');
      this.deliveryInstructions.set(a.deliveryInstructions ?? '');
      this.isDefault.set(a.isDefault);
      this.latitude.set(a.latitude);
      this.longitude.set(a.longitude);
    }
  }

  protected selectLabel(label: AddressLabel): void {
    this.label.set(label);
  }

  protected useCurrentLocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.formError.set('Location is not available on this device.');
      return;
    }

    this.locating.set(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.latitude.set(position.coords.latitude);
        this.longitude.set(position.coords.longitude);
        this.locating.set(false);
      },
      () => {
        this.formError.set('Unable to detect your location.');
        this.locating.set(false);
      },
      { timeout: 8000 },
    );
  }

  protected async submit(): Promise<void> {
    this.formError.set(null);

    if (!this.addressLine1().trim() || !this.city().trim() || !this.state().trim() || !this.postalCode().trim()) {
      this.formError.set('Please fill in the required address fields.');
      return;
    }

    const payload: CreateAddressDto & UpdateAddressDto = {
      label: this.label(),
      customLabel: this.customLabel().trim() || undefined,
      addressLine1: this.addressLine1().trim(),
      addressLine2: this.addressLine2().trim() || undefined,
      city: this.city().trim(),
      state: this.state().trim(),
      postalCode: this.postalCode().trim(),
      landmark: this.landmark().trim() || undefined,
      deliveryInstructions: this.deliveryInstructions().trim() || undefined,
      isDefault: this.isDefault(),
      latitude: this.latitude(),
      longitude: this.longitude(),
    };

    this.saving.set(true);

    const result = this.address
      ? await this.addressesFacade.update(this.address.id, payload)
      : await this.addressesFacade.create(payload);

    this.saving.set(false);

    if (result) {
      this.saved.emit(result);
    } else {
      this.formError.set('Unable to save this address. Please try again.');
    }
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
