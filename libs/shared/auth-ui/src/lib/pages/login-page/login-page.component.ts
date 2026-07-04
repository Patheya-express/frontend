import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AuthCardComponent,
  AuthLayoutComponent,
  LoginFormComponent,
  type LoginFormValue,
} from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';

export interface AuthRegisterCta {
  label: string;
  path: string;
}

const DEFAULT_REGISTER_CTA: AuthRegisterCta = { label: 'Sign up', path: '/auth/register' };

@Component({
  selector: 'lib-login-page',
  standalone: true,
  imports: [AuthLayoutComponent, AuthCardComponent, LoginFormComponent, RouterLink],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
  private readonly facade = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Each application brands and scopes registration differently; set via route `data`. */
  protected readonly brandName = this.route.snapshot.data['brandName'] ?? 'Patheya Express';
  protected readonly registerCta: AuthRegisterCta | null =
    'registerCta' in this.route.snapshot.data
      ? (this.route.snapshot.data['registerCta'] as AuthRegisterCta | null)
      : DEFAULT_REGISTER_CTA;

  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;

  protected async onSubmit(value: LoginFormValue): Promise<void> {
    const success = await this.facade.login(value);

    if (success) {
      const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
      await this.router.navigateByUrl(redirectTo ?? '/');
    }
  }
}
