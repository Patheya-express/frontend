import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AuthCardComponent,
  AuthLayoutComponent,
  ForgotPasswordFormComponent,
  type ForgotPasswordFormValue,
} from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';

@Component({
  selector: 'lib-forgot-password-page',
  standalone: true,
  imports: [AuthLayoutComponent, AuthCardComponent, ForgotPasswordFormComponent, RouterLink],
  templateUrl: './forgot-password-page.component.html',
  styleUrl: './forgot-password-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPageComponent {
  private readonly facade = inject(AuthFacade);
  private readonly route = inject(ActivatedRoute);

  protected readonly brandName = this.route.snapshot.data['brandName'] ?? 'Patheya Express';
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;

  /** The backend returns the same generic message whether or not the email matched an
   *  account — this only tracks "the request itself succeeded," not "an email was sent." */
  protected readonly submitted = signal(false);

  protected async onSubmit(value: ForgotPasswordFormValue): Promise<void> {
    const success = await this.facade.forgotPassword(value);

    if (success) {
      this.submitted.set(true);
    }
  }
}
