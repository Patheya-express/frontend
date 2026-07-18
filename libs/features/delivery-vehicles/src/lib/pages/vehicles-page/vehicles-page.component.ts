import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { VehicleResponseDto } from '@patheya-express-frontend/api-sdk';
import {
  ConfirmDialogComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  SkeletonComponent,
  StatusChipComponent,
  type StatusChipTone,
} from '@patheya-express-frontend/ui';
import { DeliveryVehiclesFacade } from '../../facades/delivery-vehicles.facade';

const VEHICLE_TYPES = ['BIKE', 'SCOOTER', 'BICYCLE', 'CAR', 'ELECTRIC_VEHICLE'] as const;
const FUEL_TYPES = ['PETROL', 'DIESEL', 'ELECTRIC', 'CNG', 'HYBRID'] as const;

function verificationTone(status: VehicleResponseDto['verificationStatus']): StatusChipTone {
  switch (status) {
    case 'VERIFIED':
      return 'success';
    case 'REJECTED':
    case 'EXPIRED':
      return 'error';
    case 'UNDER_REVIEW':
      return 'info';
    default:
      return 'neutral';
  }
}

/** Vehicle CRUD with a replacement workflow (deactivate + create new) rather than hard delete,
 *  mirroring the backend's DeliveryVehicle.isActive design. */
@Component({
  selector: 'lib-vehicles-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    SkeletonComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    StatusChipComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './vehicles-page.component.html',
  styleUrl: './vehicles-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehiclesPageComponent implements OnInit {
  protected readonly facade = inject(DeliveryVehiclesFacade);
  private readonly fb = inject(FormBuilder);

  protected readonly vehicleTypes = VEHICLE_TYPES;
  protected readonly fuelTypes = FUEL_TYPES;
  protected readonly verificationTone = verificationTone;

  protected readonly showForm = signal(false);
  protected readonly pendingDeactivateId = signal<string | null>(null);

  protected readonly vehicleForm = this.fb.nonNullable.group({
    vehicleType: ['BIKE' as (typeof VEHICLE_TYPES)[number], Validators.required],
    registrationNumber: ['', Validators.required],
    brand: [''],
    model: [''],
    year: [new Date().getFullYear()],
    fuelType: ['PETROL' as (typeof FUEL_TYPES)[number]],
    color: [''],
  });

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected retry(): void {
    this.facade.refresh();
  }

  protected openForm(): void {
    this.vehicleForm.reset({
      vehicleType: 'BIKE',
      registrationNumber: '',
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      fuelType: 'PETROL',
      color: '',
    });
    this.showForm.set(true);
  }

  protected cancelForm(): void {
    this.showForm.set(false);
  }

  protected onSubmitVehicle(): void {
    if (this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }

    const value = this.vehicleForm.getRawValue();

    void this.facade
      .create({
        vehicleType: value.vehicleType,
        registrationNumber: value.registrationNumber,
        brand: value.brand || undefined,
        model: value.model || undefined,
        year: value.year || undefined,
        fuelType: value.fuelType,
        color: value.color || undefined,
      })
      .then((ok) => {
        if (ok) {
          this.showForm.set(false);
        }
      });
  }

  protected setPrimary(vehicleId: string): void {
    void this.facade.setPrimary(vehicleId);
  }

  protected requestDeactivate(vehicleId: string): void {
    this.pendingDeactivateId.set(vehicleId);
  }

  protected confirmDeactivate(): void {
    const vehicleId = this.pendingDeactivateId();
    if (!vehicleId) {
      return;
    }
    void this.facade.deactivate(vehicleId).finally(() => this.pendingDeactivateId.set(null));
  }

  protected cancelDeactivate(): void {
    this.pendingDeactivateId.set(null);
  }
}
