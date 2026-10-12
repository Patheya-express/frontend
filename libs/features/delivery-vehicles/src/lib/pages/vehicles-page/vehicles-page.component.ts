import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import type { VehicleResponseDto } from '@patheya-express-frontend/api-sdk';
import {
  ConfirmDialogComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  FieldErrorComponent,
  SkeletonComponent,
  StatusChipComponent,
  focusFirstInvalidControl,
  type StatusChipTone,
} from '@patheya-express-frontend/ui';
import { DeliveryVehiclesFacade } from '../../facades/delivery-vehicles.facade';

const VEHICLE_TYPES = [
  'BIKE',
  'SCOOTER',
  'BICYCLE',
  'CAR',
  'ELECTRIC_VEHICLE',
] as const;
const FUEL_TYPES = ['PETROL', 'DIESEL', 'ELECTRIC', 'CNG', 'HYBRID'] as const;

type VehicleType = (typeof VEHICLE_TYPES)[number];
type FuelType = (typeof FUEL_TYPES)[number];

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  BIKE: 'Motorbike',
  SCOOTER: 'Scooter',
  BICYCLE: 'Bicycle',
  CAR: 'Car',
  ELECTRIC_VEHICLE: 'Electric vehicle',
};

const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  PETROL: 'Petrol',
  DIESEL: 'Diesel',
  ELECTRIC: 'Electric',
  CNG: 'CNG',
  HYBRID: 'Hybrid',
};

/** Same bounds CreateVehicleDto enforces (@Min(1980) @Max(2100)). */
export const VEHICLE_YEAR_MIN = 1980;
export const VEHICLE_YEAR_MAX = 2100;

/** Empty or whitespace-only counts as missing — mirrors the backend's non-blank check. */
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { required: true };
}

function verificationTone(
  status: VehicleResponseDto['verificationStatus'],
): StatusChipTone {
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
    FieldErrorComponent,
  ],
  templateUrl: './vehicles-page.component.html',
  styleUrl: './vehicles-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehiclesPageComponent implements OnInit {
  protected readonly facade = inject(DeliveryVehiclesFacade);
  private readonly fb = inject(FormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly vehicleTypes = VEHICLE_TYPES;
  protected readonly fuelTypes = FUEL_TYPES;
  protected readonly vehicleTypeLabels = VEHICLE_TYPE_LABELS;
  protected readonly fuelTypeLabels = FUEL_TYPE_LABELS;
  protected readonly yearMin = VEHICLE_YEAR_MIN;
  protected readonly yearMax = VEHICLE_YEAR_MAX;
  protected readonly verificationTone = verificationTone;

  protected readonly showForm = signal(false);
  protected readonly pendingDeactivateId = signal<string | null>(null);

  protected readonly vehicleForm = this.fb.nonNullable.group({
    vehicleType: ['BIKE' as VehicleType, Validators.required],
    registrationNumber: ['', notBlank],
    brand: [''],
    model: [''],
    year: [
      new Date().getFullYear() as number | null,
      [Validators.min(VEHICLE_YEAR_MIN), Validators.max(VEHICLE_YEAR_MAX)],
    ],
    // Optional on the backend — previously always defaulted to PETROL, which recorded a fuel
    // type even for bicycles. Empty means "not specified".
    fuelType: ['' as '' | FuelType],
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
      fuelType: '',
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
      focusFirstInvalidControl(this.host.nativeElement);
      return;
    }

    const value = this.vehicleForm.getRawValue();

    void this.facade
      .create({
        vehicleType: value.vehicleType,
        registrationNumber: value.registrationNumber.trim(),
        brand: value.brand.trim() || undefined,
        model: value.model.trim() || undefined,
        year: value.year ?? undefined,
        fuelType: value.fuelType || undefined,
        color: value.color.trim() || undefined,
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
    void this.facade
      .deactivate(vehicleId)
      .finally(() => this.pendingDeactivateId.set(null));
  }

  protected cancelDeactivate(): void {
    this.pendingDeactivateId.set(null);
  }
}
