import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {
  PartnerShellComponent,
  RestaurantBranchSwitcherComponent,
  type PartnerNavLink,
  type SwitcherOption,
} from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';
import {
  MobilePlatformService,
  PushNotificationsService,
  RestaurantContextService,
  resolvePushTapRoute,
} from '@patheya-express-frontend/core';
import { NotificationsService } from '@patheya-express-frontend/api-sdk';

const NAV_LINKS: PartnerNavLink[] = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Orders', path: '/orders' },
  { label: 'Menu', path: '/menu' },
  { label: 'Branches', path: '/branches' },
  { label: 'Staff', path: '/staff' },
  { label: 'Holidays', path: '/holidays' },
  { label: 'Gallery', path: '/gallery' },
  { label: 'Offers', path: '/offers' },
  { label: 'Reviews', path: '/reviews' },
  { label: 'Reports', path: '/reports' },
  { label: 'Settings', path: '/settings/business' },
  { label: 'Notifications', path: '/notifications' },
  { label: 'Profile', path: '/profile' },
];

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [
    RouterOutlet,
    PartnerShellComponent,
    RestaurantBranchSwitcherComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly authFacade = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly mobilePlatformService = inject(MobilePlatformService);
  private readonly pushNotificationsService = inject(PushNotificationsService);
  private readonly notificationsService = inject(NotificationsService);
  protected readonly context = inject(RestaurantContextService);

  protected readonly isAuthenticated = this.authFacade.isAuthenticated;
  protected readonly isNative = this.mobilePlatformService.isNative();
  protected readonly navLinks = NAV_LINKS;
  protected readonly brandName = 'Patheya Express for Restaurants';

  constructor() {
    // Push notifications: request permission + register once signed in on native; a signed-out
    // guest is never prompted. Mirrors customer-app's wiring — see `PushNotificationsService` for
    // why re-running this on every isAuthenticated() flip to true is safe.
    effect(() => {
      if (this.isNative && this.isAuthenticated()) {
        void this.pushNotificationsService.initialize();
      }
    });

    // Sends the device token to the backend as soon as registration completes, and again if it
    // ever changes.
    effect(() => {
      const token = this.pushNotificationsService.token();
      const platform = this.mobilePlatformService.platform();

      if (!token || platform === 'web' || !this.isAuthenticated()) {
        return;
      }

      void this.notificationsService.notificationsControllerRegisterPushToken({
        body: { platform, token },
      });
    });

    // Restaurant-app has no per-order push payload contract yet (unlike customer-app's
    // documented `data.notificationId`) — a tap always wakes the app to the Orders screen, which
    // reloads authoritative state itself, rather than guessing at an unproven payload field.
    effect(() => {
      const tapped = this.pushNotificationsService.tapped();
      if (!tapped) {
        return;
      }

      this.pushNotificationsService.acknowledgeTap();

      const routerPath = resolvePushTapRoute(tapped.data, {
        rootSegment: 'orders',
      });
      if (routerPath) {
        void this.router.navigateByUrl(routerPath);
      }
    });
  }

  protected readonly restaurantOptions = computed<SwitcherOption[]>(() =>
    this.context
      .restaurants()
      .map((restaurant) => ({ id: restaurant.id, label: restaurant.name })),
  );

  protected readonly branchOptions = computed<SwitcherOption[]>(() =>
    this.context
      .branches()
      .map((branch) => ({ id: branch.id, label: branch.name })),
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
