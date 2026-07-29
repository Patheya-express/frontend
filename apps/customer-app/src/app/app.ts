import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AppShellComponent,
  BottomSheetHostComponent,
  BottomSheetService,
  confirmDialog,
  DialogHostComponent,
  DialogService,
  OfflineBannerComponent,
  ToastHostComponent,
  type OverlayRef,
} from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { MediaUrlService } from '@patheya-express-frontend/core';
import { CustomerProfileFacade } from '@patheya-express-frontend/customer-profile';
import { CustomerNotificationsFacade } from '@patheya-express-frontend/customer-notifications';
import { AddressPickerComponent, AddressesFacade } from '@patheya-express-frontend/addresses';
import {
  CartCheckoutBarComponent,
  CartConflictDialogComponent,
  CartDrawerComponent,
  CartFacade,
} from '@patheya-express-frontend/cart';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [
    AppShellComponent,
    CartDrawerComponent,
    CartConflictDialogComponent,
    CartCheckoutBarComponent,
    DialogHostComponent,
    ToastHostComponent,
    OfflineBannerComponent,
    BottomSheetHostComponent,
  ],
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
  private readonly dialogService = inject(DialogService);
  private readonly bottomSheetService = inject(BottomSheetService);
  private readonly addressesFacade = inject(AddressesFacade);

  protected readonly isAuthenticated = this.authFacade.isAuthenticated;
  protected readonly cartItemCount = this.cartFacade.totalItems;
  protected readonly notificationCount = this.customerNotificationsFacade.unreadCount;
  protected readonly cartOpen = signal(false);
  protected readonly deliveryLocationLabel = signal('Select a location');

  protected readonly avatarUrl = computed(() =>
    this.mediaUrlService.resolve(this.customerProfileFacade.avatarUrl()),
  );
  protected readonly firstName = computed(() => this.customerProfileFacade.profile()?.firstName ?? '');

  private addressSheetRef?: OverlayRef;

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

    // Address switcher (see onLocationPickerClicked): AddressPickerComponent has no "selected,
    // now close me" output of its own (it's also embedded inline elsewhere — checkout's
    // address-section — where there's nothing to close), so this reacts to the facade's own
    // `selectedAddress` signal instead, closing whichever sheet is open the moment a choice
    // lands, without needing to modify that component for this one call site.
    effect(() => {
      const selected = this.addressesFacade.selectedAddress();
      if (!selected || !this.addressSheetRef) {
        return;
      }

      this.deliveryLocationLabel.set(selected.customLabel ?? selected.addressLine1);
      this.addressSheetRef.close();
      this.addressSheetRef = undefined;
    });
  }

  protected async onLogout(): Promise<void> {
    const confirmed = await confirmDialog(this.dialogService, {
      title: 'Log out?',
      message: "You'll need to log in again to place orders or view your account.",
      confirmLabel: 'Log out',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

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
   * Signed-in customers get the real address switcher — their saved addresses (add/edit/select),
   * reusing `AddressPickerComponent` exactly as checkout already does, just inside a bottom sheet
   * here instead of embedded inline. Guests have no saved addresses to switch between, so they
   * keep the existing raw-geolocation fallback unchanged (no reverse-geocoding integration exists
   * yet, so that path can only confirm a location was captured, not resolve it to a readable
   * address — a pre-existing limitation, not something this change touches).
   */
  protected onLocationPickerClicked(): void {
    if (this.isAuthenticated()) {
      this.addressSheetRef = this.bottomSheetService.open(AddressPickerComponent, {
        ariaLabel: 'Choose delivery address',
      });
      return;
    }

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
