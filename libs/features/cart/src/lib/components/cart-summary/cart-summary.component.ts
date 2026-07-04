import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CartFacade } from '../../facades/cart.facade';

@Component({
  selector: 'lib-cart-summary',
  standalone: true,
  templateUrl: './cart-summary.component.html',
  styleUrl: './cart-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartSummaryComponent {
  private readonly cartFacade = inject(CartFacade);

  protected readonly totalItems = this.cartFacade.totalItems;
  protected readonly subtotal = this.cartFacade.subtotal;
}
