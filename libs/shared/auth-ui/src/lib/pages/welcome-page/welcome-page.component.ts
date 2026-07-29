import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PrimaryButtonComponent, SecondaryButtonComponent } from '@patheya-express-frontend/ui';
import { HAS_SEEN_WELCOME_KEY } from '../../state/welcome-storage';

/**
 * Brand + Login/Register entry point. Reached two ways: automatically, once, on a device's
 * first-ever launch (see `SplashPageComponent.resolveDefaultTarget`); or anytime via `/welcome`
 * directly. Deliberately does **not** sit in front of guest browsing — the existing public routes
 * (`/`, `/restaurants`, …) are unchanged and reachable without ever seeing this screen, matching
 * this app's existing "browse without an account" behavior.
 */
@Component({
  selector: 'lib-welcome-page',
  standalone: true,
  imports: [RouterLink, PrimaryButtonComponent, SecondaryButtonComponent],
  templateUrl: './welcome-page.component.html',
  styleUrl: './welcome-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly brandName = this.route.snapshot.data['brandName'] ?? 'Patheya Express';
  protected readonly tagline =
    this.route.snapshot.data['tagline'] ?? 'Great food, delivered fast — right to your door.';

  constructor() {
    localStorage.setItem(HAS_SEEN_WELCOME_KEY, 'true');
  }

  protected goToLogin(): void {
    void this.router.navigateByUrl('/auth/login');
  }

  protected goToRegister(): void {
    void this.router.navigateByUrl('/auth/register');
  }
}
