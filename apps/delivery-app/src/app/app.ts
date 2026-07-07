import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PartnerShellComponent, type PartnerNavLink } from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';

const NAV_LINKS: PartnerNavLink[] = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Assignments', path: '/assignments' },
  { label: 'Fees', path: '/fees' },
];

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet, PartnerShellComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly authFacade = inject(AuthFacade);
  private readonly router = inject(Router);

  protected readonly isAuthenticated = this.authFacade.isAuthenticated;
  protected readonly navLinks = NAV_LINKS;
  protected readonly brandName = 'Patheya Express Courier';

  protected async onLogout(): Promise<void> {
    await this.authFacade.logout();
    await this.router.navigateByUrl('/auth/login');
  }
}
