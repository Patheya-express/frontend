import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import type { MenuItemResponseDto } from '@patheya-express-frontend/api-sdk';
import { CartFacade } from '@patheya-express-frontend/cart';
import { HapticsService, MediaUrlService } from '@patheya-express-frontend/core';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { FavoriteButtonComponent } from '@patheya-express-frontend/favorites';
import { highlightSegments } from '@patheya-express-frontend/ui';
import { MenuItemCustomizationSheetComponent } from '../menu-item-customization-sheet/menu-item-customization-sheet.component';

@Component({
  selector: 'lib-menu-item-card',
  standalone: true,
  imports: [MenuItemCustomizationSheetComponent, FavoriteButtonComponent],
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
    void this.cartFacade.addItem({
      menuItemId: this.item.id,
      restaurantName: this.restaurantName,
    });
  }

  protected increase(): void {
    const item = this.simpleCartItem();
    if (item) {
      void this.haptics.selectionChanged();
      void this.cartFacade.increaseQuantity(item.id);
    }
  }

  protected decrease(): void {
    const item = this.simpleCartItem();
    if (item) {
      void this.haptics.selectionChanged();
      void this.cartFacade.decreaseQuantity(item.id);
    }
  }

  protected closeSheet(): void {
    this.showSheet.set(false);
  }
}
