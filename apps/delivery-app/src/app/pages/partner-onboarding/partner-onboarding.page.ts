import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  AuthCardComponent,
  AuthLayoutComponent,
  PrimaryButtonComponent,
  focusFirstInvalidControl,
} from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { extractHttpErrorMessage } from '@patheya-express-frontend/core';
import type { CreateDeliveryPartnerDto } from '@patheya-express-frontend/api-sdk';
import { DELIVERY_PARTNER_BRAND_NAME } from '../../brand';
import { PartnerOnboardingService } from './partner-onboarding.service';

type VehicleType = CreateDeliveryPartnerDto['vehicleType'];

/** Mirrors the backend VehicleType enum (the generated DTO type enforces the values). */
const VEHICLE_TYPE_OPTIONS: ReadonlyArray<{
  value: VehicleType;
  label: string;
}> = [
  { value: 'BIKE', label: 'Motorbike' },
  { value: 'SCOOTER', label: 'Scooter' },
  { value: 'BICYCLE', label: 'Bicycle' },
  { value: 'CAR', label: 'Car' },
  { value: 'ELECTRIC_VEHICLE', label: 'Electric vehicle' },
];

/** Same minimum the backend RegisterDto enforces (@MinLength(8)). */
const PASSWORD_MIN_LENGTH = 8;

/** Rejects empty and whitespace-only input — matches the backend's `/\S/` checks. */
const notBlank: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null =>
  control.value.trim() ? null : { required: true };

const passwordsMatch: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const password = group.get('password')?.value as string | undefined;
  const confirm = group.get('confirmPassword')?.value as string | undefined;
  return confirm && password !== confirm ? { passwordMismatch: true } : null;
};

@Component({
  selector: 'app-partner-onboarding-page',
  standalone: true,
  imports: [
    AuthLayoutComponent,
    AuthCardComponent,
    RouterLink,
    ReactiveFormsModule,
    PrimaryButtonComponent,
  ],
  templateUrl: './partner-onboarding.page.html',
  styleUrl: './partner-onboarding.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOnboardingPageComponent {
  private readonly authFacade = inject(AuthFacade);
  private readonly onboardingService = inject(PartnerOnboardingService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly brandName = DELIVERY_PARTNER_BRAND_NAME;
  protected readonly vehicleTypeOptions = VEHICLE_TYPE_OPTIONS;
  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Set once account registration succeeds, so a retry after a failed onboard call doesn't re-register. */
  protected readonly accountCreated = signal(false);

  protected readonly form = new FormGroup(
    {
      firstName: new FormControl('', {
        nonNullable: true,
        validators: [notBlank],
      }),
      lastName: new FormControl('', {
        nonNullable: true,
        validators: [notBlank],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(PASSWORD_MIN_LENGTH),
        ],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      vehicleType: new FormControl<VehicleType>('BIKE', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      vehicleNumber: new FormControl('', {
        nonNullable: true,
        validators: [notBlank],
      }),
      licenseNumber: new FormControl('', { nonNullable: true }),
    },
    { validators: [passwordsMatch] },
  );

  /** Errors appear once a field has been visited or a submit was attempted, never on first render. */
  protected showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected showPasswordMismatch(): boolean {
    const confirm = this.form.controls.confirmPassword;
    return (
      confirm.touched &&
      !confirm.hasError('required') &&
      this.form.hasError('passwordMismatch')
    );
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.host.nativeElement);
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();

    try {
      if (!this.accountCreated()) {
        const registered = await this.authFacade.registerDeliveryPartner({
          firstName: value.firstName.trim(),
          lastName: value.lastName.trim(),
          email: value.email.trim(),
          password: value.password,
        });

        if (!registered) {
          this.errorMessage.set(
            this.authFacade.error() ??
              'Unable to create your account. Please try again.',
          );
          return;
        }

        this.accountCreated.set(true);
      }

      await this.onboardingService.onboard({
        vehicleType: value.vehicleType,
        vehicleNumber: value.vehicleNumber.trim(),
        licenseNumber: value.licenseNumber.trim() || undefined,
      });

      // The wizard (guarded by onboardingGuard) is the actual next step for a freshly-
      // registered partner — navigating straight to /dashboard would just bounce through
      // that guard's redirect anyway, since verification can't be APPROVED yet.
      await this.router.navigateByUrl('/onboarding');
    } catch (error) {
      this.errorMessage.set(
        extractHttpErrorMessage(
          error,
          'Your account was created, but saving your vehicle details failed. Please try again.',
        ),
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
