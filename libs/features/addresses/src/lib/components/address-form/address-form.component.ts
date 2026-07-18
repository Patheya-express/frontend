import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import type { AddressResponseDto, CreateAddressDto, UpdateAddressDto } from '@patheya-express-frontend/api-sdk';
import { MapPickerComponent, type PickedLocation } from '@patheya-express-frontend/map-picker';
import { AddressesFacade } from '../../facades/addresses.facade';

type AddressLabel = 'HOME' | 'WORK' | 'OTHER';

@Component({
  selector: 'lib-address-form',
  standalone: true,
  imports: [MapPickerComponent],
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
  protected readonly accuracy = signal<number | undefined>(undefined);
  protected readonly altitude = signal<number | undefined>(undefined);
  protected readonly heading = signal<number | undefined>(undefined);
  protected readonly speed = signal<number | undefined>(undefined);
  protected readonly locationSource = signal<PickedLocation['locationSource'] | undefined>(undefined);
  protected readonly provider = signal<PickedLocation['provider'] | undefined>(undefined);
  protected readonly providerPlaceId = signal<string | undefined>(undefined);

  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  /** Prefills the map picker's marker when editing an address that already has coordinates. */
  protected initialMapPosition: { lat: number; lng: number } | undefined = undefined;

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
      this.accuracy.set(a.accuracy);
      this.altitude.set(a.altitude);
      this.heading.set(a.heading);
      this.speed.set(a.speed);
      this.locationSource.set(a.locationSource);
      this.provider.set(a.provider);
      this.providerPlaceId.set(a.providerPlaceId);

      if (a.latitude !== undefined && a.longitude !== undefined) {
        this.initialMapPosition = { lat: a.latitude, lng: a.longitude };
      }
    }
  }

  protected selectLabel(label: AddressLabel): void {
    this.label.set(label);
  }

  /** Keeps the map picker, the address-line fields, and the GPS metadata all synchronized,
   *  regardless of whether the location came from a search selection, a map click, a marker
   *  drag, or the current-location button. */
  protected onLocationChange(location: PickedLocation): void {
    this.latitude.set(location.lat);
    this.longitude.set(location.lng);
    this.accuracy.set(location.accuracy);
    this.altitude.set(location.altitude);
    this.heading.set(location.heading);
    this.speed.set(location.speed);
    this.locationSource.set(location.locationSource);
    this.provider.set(location.provider);
    this.providerPlaceId.set(location.placeId);

    if (location.addressLine1) {
      this.addressLine1.set(location.addressLine1);
    }
    if (location.city) {
      this.city.set(location.city);
    }
    if (location.state) {
      this.state.set(location.state);
    }
    if (location.postalCode) {
      this.postalCode.set(location.postalCode);
    }
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
      accuracy: this.accuracy(),
      altitude: this.altitude(),
      heading: this.heading(),
      speed: this.speed(),
      locationSource: this.locationSource(),
      provider: this.provider(),
      providerPlaceId: this.providerPlaceId(),
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
