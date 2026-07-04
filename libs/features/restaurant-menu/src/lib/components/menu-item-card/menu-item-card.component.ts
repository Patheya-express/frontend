import { ChangeDetectionStrategy, Component, Input, computed, inject } from '@angular/core';
import type { MenuItemResponseDto } from '@patheya-express-frontend/api-sdk';
import { CartFacade } from '@patheya-express-frontend/cart';

@Component({
  selector: 'lib-menu-item-card',
  standalone: true,
  templateUrl: './menu-item-card.component.html',
  styleUrl: './menu-item-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuItemCardComponent {
  @Input({ required: true }) item!: MenuItemResponseDto;
  @Input({ required: true }) restaurantId!: string;
  @Input({ required: true }) restaurantName!: string;

  private readonly cartFacade = inject(CartFacade);

  protected readonly quantity = computed(
    () => this.cartFacade.items().find((cartItem) => cartItem.menuItemId === this.item.id)?.quantity ?? 0,
  );

  protected add(): void {
    void this.cartFacade.addItem({
      menuItemId: this.item.id,
      name: this.item.name,
      unitPrice: this.item.basePrice,
      restaurantId: this.restaurantId,
      restaurantName: this.restaurantName,
    });
  }

  protected increase(): void {
    void this.cartFacade.increaseQuantity(this.item.id);
  }

  protected decrease(): void {
    void this.cartFacade.decreaseQuantity(this.item.id);
  }
}
