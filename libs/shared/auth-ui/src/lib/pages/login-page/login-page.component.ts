import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AuthCardComponent,
  AuthLayoutComponent,
  LoginFormComponent,
  type LoginFormValue,
} from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { MobilePlatformService } from '@patheya-express-frontend/core';

export interface AuthRegisterCta {
  label: string;
  path: string;
}

const DEFAULT_REGISTER_CTA: AuthRegisterCta = { label: 'Sign up', path: '/auth/register' };
const REMEMBERED_EMAIL_KEY = 'patheya.auth.rememberedEmail';

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

  /** Extension point for a future biometric-login shortcut (Face ID/fingerprint) — deliberately
   *  not implemented yet, per product scope. Only meaningful inside the native shell (the web
   *  build has no biometric API to call), so it's gated on platform now rather than left as a
   *  TODO with no seam: a future biometric feature reads this signal to decide whether to render
   *  its own affordance here, without this page needing to change. */
  private readonly mobilePlatform = inject(MobilePlatformService);
  protected readonly canOfferBiometricLogin = this.mobilePlatform.isNative();

  /** Each application brands and scopes registration differently; set via route `data`. */
  protected readonly brandName = this.route.snapshot.data['brandName'] ?? 'Patheya Express';
  protected readonly registerCta: AuthRegisterCta | null =
    'registerCta' in this.route.snapshot.data
      ? (this.route.snapshot.data['registerCta'] as AuthRegisterCta | null)
      : DEFAULT_REGISTER_CTA;

  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;

  /** Forwarded onto the Sign-up/Forgot-password links below so a guest bounced here from a
   *  protected route (e.g. checkout, via `authGuard`'s own `redirectTo`) doesn't lose that
   *  destination by detouring through either flow — without it, completing either one always
   *  landed on the home page regardless of where the user was originally headed. */
  protected readonly redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
  protected readonly redirectToQueryParams = this.redirectTo ? { redirectTo: this.redirectTo } : {};

  /** UI-only convenience (see `LoginFormValue.rememberMe`) — `LoginDto` itself has no such field
   *  and `AuthStorageService` already persists every session to `localStorage` unconditionally,
   *  so this only remembers the *email* for next time, not session duration/behavior. */
  protected readonly rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '';

  protected async onSubmit(value: LoginFormValue): Promise<void> {
    const success = await this.facade.login({ email: value.email, password: value.password });

    if (!success) {
      return;
    }

    if (value.rememberMe) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, value.email);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    const homePath = (this.route.snapshot.data['homePath'] as string | undefined) ?? '/';
    await this.router.navigateByUrl(this.redirectTo ?? homePath);
  }
}
