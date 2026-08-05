import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import type { MenuItemResponseDto } from '@patheya-express-frontend/api-sdk';
import { CartFacade } from '@patheya-express-frontend/cart';
import { HapticsService, MediaUrlService } from '@patheya-express-frontend/core';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { FavoriteButtonComponent } from '@patheya-express-frontend/favorites';
import { highlightSegments, LazyImageDirective, MOBILE_MOTION_DURATIONS_MS } from '@patheya-express-frontend/ui';
import { MenuItemCustomizationSheetComponent } from '../menu-item-customization-sheet/menu-item-customization-sheet.component';

@Component({
  selector: 'lib-menu-item-card',
  standalone: true,
  imports: [MenuItemCustomizationSheetComponent, FavoriteButtonComponent, LazyImageDirective],
  templateUrl: './menu-item-card.component.html',
  styleUrl: './menu-item-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuItemCardComponent {
  @Input({ required: true }) item!: MenuItemResponseDto;
  @Input({ required: true }) restaurantName!: string;
  /** Current menu search term, purely for highlighting matches — filtering itself happens server-side. */
  @Input() searchQuery = '';

  private readonly cartFacade = inject(CartFacade);
  private readonly mediaUrlService = inject(MediaUrlService);
  private readonly authFacade = inject(AuthFacade);
  private readonly haptics = inject(HapticsService);

  protected readonly isAuthenticated = this.authFacade.isAuthenticated;

  protected readonly showSheet = signal(false);

  /** Brief scale-pop on the cart action area for tactile confirmation — pulses on every add/
   *  increase/decrease, not just the first add, since a stepper tap deserves the same "that
   *  registered" feedback as the initial Add tap. Reset via setTimeout rather than
   *  `animationend` — a rapid double-tap re-triggers cleanly either way, and this avoids needing
   *  a DOM event listener for a purely decorative signal. */
  protected readonly cartBump = signal(false);
  private cartBumpTimeout?: ReturnType<typeof setTimeout>;

  private triggerCartBump(): void {
    clearTimeout(this.cartBumpTimeout);
    this.cartBump.set(false);
    // Two RAFs (not zero) so Angular has actually flushed the class removal to the DOM before
    // re-adding it — a single microtask/RAF can still land in the same paint as the removal.
    requestAnimationFrame(() => requestAnimationFrame(() => this.cartBump.set(true)));
    this.cartBumpTimeout = setTimeout(() => this.cartBump.set(false), MOBILE_MOTION_DURATIONS_MS.base);
  }

  protected readonly imageUrl = computed(() => this.mediaUrlService.resolve(this.item.imageUrl));

  protected readonly hasCustomizations = computed(
    () => this.item.variants.length > 0 || this.item.addons.length > 0,
  );
  protected readonly hasVariants = computed(() => this.item.variants.length > 0);
  protected readonly hasAddons = computed(() => this.item.addons.length > 0);

  protected readonly nameSegments = computed(() => highlightSegments(this.item.name, this.searchQuery));

  /** The single, non-customized cart line for this item — the only one the inline +/- stepper can unambiguously control. */
  protected readonly simpleCartItem = computed(() =>
    this.cartFacade
      .items()
      .find((cartItem) => cartItem.menuItemId === this.item.id && !cartItem.variantId && cartItem.addonOptions.length === 0),
  );

  /** Total quantity across every cart line for this menu item, regardless of chosen customization. */
  protected readonly totalQuantityInCart = computed(() =>
    this.cartFacade
      .items()
      .filter((cartItem) => cartItem.menuItemId === this.item.id)
      .reduce((sum, cartItem) => sum + cartItem.quantity, 0),
  );

  protected add(): void {
    if (this.hasCustomizations()) {
      this.showSheet.set(true);
      return;
    }

    void this.haptics.action();
    this.triggerCartBump();
    void this.cartFacade.addItem({
      menuItemId: this.item.id,
      restaurantName: this.restaurantName,
    });
  }

  protected increase(): void {
    const item = this.simpleCartItem();
    if (item) {
      void this.haptics.selectionChanged();
      this.triggerCartBump();
      void this.cartFacade.increaseQuantity(item.id);
    }
  }

  protected decrease(): void {
    const item = this.simpleCartItem();
    if (item) {
      void this.haptics.selectionChanged();
      this.triggerCartBump();
      void this.cartFacade.decreaseQuantity(item.id);
    }
  }

  protected closeSheet(): void {
    this.showSheet.set(false);
  }
}
