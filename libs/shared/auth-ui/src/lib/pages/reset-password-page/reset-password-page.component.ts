import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AuthCardComponent,
  AuthLayoutComponent,
  ResetPasswordFormComponent,
  type ResetPasswordFormValue,
} from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';

@Component({
  selector: 'lib-reset-password-page',
  standalone: true,
  imports: [AuthLayoutComponent, AuthCardComponent, ResetPasswordFormComponent, RouterLink],
  templateUrl: './reset-password-page.component.html',
  styleUrl: './reset-password-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPageComponent {
  private readonly facade = inject(AuthFacade);
  private readonly route = inject(ActivatedRoute);

  protected readonly brandName = this.route.snapshot.data['brandName'] ?? 'Patheya Express';
  /** Read once from the reset-link URL (`/auth/reset-password?token=...`, as emailed by
   *  forgotPassword) — missing/absent means the user reached this page without a valid link. */
  protected readonly token = this.route.snapshot.queryParamMap.get('token');
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly submitted = signal(false);

  protected async onSubmit(value: ResetPasswordFormValue): Promise<void> {
    if (!this.token) {
      return;
    }

    const success = await this.facade.resetPassword({
      token: this.token,
      newPassword: value.newPassword,
    });

    if (success) {
      this.submitted.set(true);
    }
  }
}
