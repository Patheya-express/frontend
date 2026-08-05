import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AuthCardComponent,
  AuthLayoutComponent,
  RegisterFormComponent,
  type RegisterFormValue,
} from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';

@Component({
  selector: 'lib-register-page',
  standalone: true,
  imports: [AuthLayoutComponent, AuthCardComponent, RegisterFormComponent, RouterLink],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPageComponent {
  private readonly facade = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;

  /** Forwarded here from the login page's Sign-up link (see LoginPageComponent) when a guest was
   *  bounced to login from a protected route — without reading it, registering (which auto-logs
   *  the new account in, see AuthStore.applySession) always landed on the home page instead of
   *  wherever the user was originally headed. */
  private readonly redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');

  protected async onSubmit(value: RegisterFormValue): Promise<void> {
    const success = await this.facade.register(value);

    if (success) {
      await this.router.navigateByUrl(this.redirectTo ?? '/');
    }
  }
}
