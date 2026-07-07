import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthCardComponent, AuthLayoutComponent } from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { PartnerOnboardingService } from './partner-onboarding.service';

const VEHICLE_TYPES = ['BIKE', 'SCOOTER', 'BICYCLE', 'CAR'] as const;

@Component({
  selector: 'app-partner-onboarding-page',
  standalone: true,
  imports: [AuthLayoutComponent, AuthCardComponent, RouterLink, ReactiveFormsModule],
  templateUrl: './partner-onboarding.page.html',
  styleUrl: './partner-onboarding.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOnboardingPageComponent {
  private readonly authFacade = inject(AuthFacade);
  private readonly onboardingService = inject(PartnerOnboardingService);
  private readonly router = inject(Router);

  protected readonly vehicleTypes = VEHICLE_TYPES;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Set once account registration succeeds, so a retry after a failed onboard call doesn't re-register. */
  private accountCreated = false;

  protected readonly form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    vehicleType: new FormControl<(typeof VEHICLE_TYPES)[number]>('BIKE', { nonNullable: true }),
    vehicleNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    licenseNumber: new FormControl('', { nonNullable: true }),
  });

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    try {
      if (!this.accountCreated) {
        const { firstName, lastName, email, password } = this.form.getRawValue();
        const registered = await this.authFacade.registerDeliveryPartner({ firstName, lastName, email, password });

        if (!registered) {
          this.errorMessage.set(this.authFacade.error() ?? 'Unable to create your account.');
          return;
        }

        this.accountCreated = true;
      }

      const { vehicleType, vehicleNumber, licenseNumber } = this.form.getRawValue();
      await this.onboardingService.onboard({
        vehicleType,
        vehicleNumber,
        licenseNumber: licenseNumber || undefined,
      });

      await this.router.navigateByUrl('/dashboard');
    } catch {
      this.errorMessage.set('Account created, but saving your vehicle details failed. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }
}
