import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppShellComponent } from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { MediaUrlService } from '@patheya-express-frontend/core';
import { CustomerProfileFacade } from '@patheya-express-frontend/customer-profile';
import { CustomerNotificationsFacade } from '@patheya-express-frontend/customer-notifications';
import {
  CartCheckoutBarComponent,
  CartConflictDialogComponent,
  CartDrawerComponent,
  CartFacade,
} from '@patheya-express-frontend/cart';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [AppShellComponent, CartDrawerComponent, CartConflictDialogComponent, CartCheckoutBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly authFacade = inject(AuthFacade);
  private readonly cartFacade = inject(CartFacade);
  private readonly customerProfileFacade = inject(CustomerProfileFacade);
  private readonly customerNotificationsFacade = inject(CustomerNotificationsFacade);
  private readonly mediaUrlService = inject(MediaUrlService);
  private readonly router = inject(Router);

  protected readonly isAuthenticated = this.authFacade.isAuthenticated;
  protected readonly cartItemCount = this.cartFacade.totalItems;
  protected readonly notificationCount = this.customerNotificationsFacade.unreadCount;
  protected readonly cartOpen = signal(false);
  protected readonly deliveryLocationLabel = signal('Select a location');

  protected readonly avatarUrl = computed(() =>
    this.mediaUrlService.resolve(this.customerProfileFacade.avatarUrl()),
  );
  protected readonly firstName = computed(() => this.customerProfileFacade.profile()?.firstName ?? '');

  constructor() {
    // Cart is backend-authenticated — (re)fetch it whenever a session becomes active, since the
    // app-bootstrap restore only covers a user who was already logged in on page load.
    effect(() => {
      if (this.isAuthenticated()) {
        void this.cartFacade.restore();
        void this.customerProfileFacade.ensureProfileLoaded();
        void this.customerNotificationsFacade.loadUnreadCount();
      }
    });
  }

  protected async onLogout(): Promise<void> {
    await this.authFacade.logout();
    await this.router.navigateByUrl('/auth/login');
  }

  protected toggleCart(): void {
    this.cartOpen.update((open) => !open);
  }

  protected closeCart(): void {
    this.cartOpen.set(false);
  }

  protected onSearchSubmitted(search: string): void {
    void this.router.navigate(['/restaurants'], { queryParams: { search } });
  }

  protected onNotificationsToggled(): void {
    void this.router.navigate(['/notifications']);
  }

  /**
   * No reverse-geocoding integration exists yet, so this can only confirm that a location was
   * captured — not resolve it to a readable address. A full address book/geocoding feature is
   * out of scope for this phase.
   */
  protected onLocationPickerClicked(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.deliveryLocationLabel.set('Location unavailable');
      return;
    }

    this.deliveryLocationLabel.set('Detecting location…');

    navigator.geolocation.getCurrentPosition(
      () => this.deliveryLocationLabel.set('Current location'),
      () => this.deliveryLocationLabel.set('Location unavailable'),
      { timeout: 5000 },
    );
  }
}
