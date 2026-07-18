import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthCardComponent, AuthLayoutComponent } from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { PartnerApplicationService } from './partner-application.service';

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Component({
  selector: 'app-partner-application-page',
  standalone: true,
  imports: [AuthLayoutComponent, AuthCardComponent, RouterLink, ReactiveFormsModule],
  templateUrl: './partner-application.page.html',
  styleUrl: './partner-application.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerApplicationPageComponent {
  private readonly authFacade = inject(AuthFacade);
  private readonly applicationService = inject(PartnerApplicationService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Set once account registration succeeds, so a retry after a failed application call doesn't re-register. */
  private accountCreated = false;

  protected readonly form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    restaurantName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', { nonNullable: true }),
  });

  protected get slugPreview(): string {
    return slugify(this.form.controls.restaurantName.value);
  }

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
        const registered = await this.authFacade.registerRestaurantOwner({ firstName, lastName, email, password });

        if (!registered) {
          this.errorMessage.set(this.authFacade.error() ?? 'Unable to create your account.');
          return;
        }

        this.accountCreated = true;
      }

      const { restaurantName, phone } = this.form.getRawValue();
      await this.applicationService.createRestaurant({
        name: restaurantName,
        slug: slugify(restaurantName),
        phone: phone || undefined,
      });

      await this.router.navigateByUrl('/onboarding');
    } catch {
      this.errorMessage.set('Account created, but saving your restaurant details failed. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }
}
