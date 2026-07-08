import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import type { CartItem } from '../../models/cart-item.model';
import { CartFacade } from '../../facades/cart.facade';

@Component({
  selector: 'lib-cart-item',
  standalone: true,
  templateUrl: './cart-item.component.html',
  styleUrl: './cart-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartItemComponent {
  @Input({ required: true }) item!: CartItem;

  private readonly cartFacade = inject(CartFacade);

  protected increase(): void {
    void this.cartFacade.increaseQuantity(this.item.id);
  }

  protected decrease(): void {
    void this.cartFacade.decreaseQuantity(this.item.id);
  }

  protected remove(): void {
    void this.cartFacade.removeItem(this.item.id);
  }
}
