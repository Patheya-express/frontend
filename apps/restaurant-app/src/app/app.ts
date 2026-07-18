import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {
  PartnerShellComponent,
  RestaurantBranchSwitcherComponent,
  type PartnerNavLink,
  type SwitcherOption,
} from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { RestaurantContextService } from '@patheya-express-frontend/core';

const NAV_LINKS: PartnerNavLink[] = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Orders', path: '/orders' },
  { label: 'Menu', path: '/menu' },
  { label: 'Branches', path: '/branches' },
  { label: 'Staff', path: '/staff' },
  { label: 'Holidays', path: '/holidays' },
  { label: 'Gallery', path: '/gallery' },
  { label: 'Settings', path: '/settings/business' },
  { label: 'Notifications', path: '/notifications' },
  { label: 'Profile', path: '/profile' },
];

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet, PartnerShellComponent, RestaurantBranchSwitcherComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly authFacade = inject(AuthFacade);
  private readonly router = inject(Router);
  protected readonly context = inject(RestaurantContextService);

  protected readonly isAuthenticated = this.authFacade.isAuthenticated;
  protected readonly navLinks = NAV_LINKS;
  protected readonly brandName = 'Patheya Express for Restaurants';

  protected readonly restaurantOptions = computed<SwitcherOption[]>(() =>
    this.context.restaurants().map((restaurant) => ({ id: restaurant.id, label: restaurant.name })),
  );

  protected readonly branchOptions = computed<SwitcherOption[]>(() =>
    this.context.branches().map((branch) => ({ id: branch.id, label: branch.name })),
  );

  protected async onLogout(): Promise<void> {
    await this.authFacade.logout();
    await this.router.navigateByUrl('/auth/login');
  }

  /** Switching restaurant/branch changes what every feature store resolves as "current" — a
   *  full reload is the simplest way to guarantee every already-open page (dashboard, orders,
   *  menu, profile) re-fetches under the new context rather than threading a refresh signal
   *  through each store individually. */
  protected async onRestaurantChange(restaurantId: string): Promise<void> {
    await this.context.setCurrentRestaurant(restaurantId);
    window.location.reload();
  }

  protected onBranchChange(branchId: string): void {
    this.context.setCurrentBranch(branchId);
    window.location.reload();
  }
}
