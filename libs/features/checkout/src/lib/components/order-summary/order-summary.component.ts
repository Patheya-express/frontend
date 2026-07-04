import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CartItemComponent, CartSummaryComponent } from '@patheya-express-frontend/cart';
import { CheckoutFacade } from '../../facades/checkout.facade';

@Component({
  selector: 'lib-order-summary',
  standalone: true,
  imports: [CartItemComponent, CartSummaryComponent],
  templateUrl: './order-summary.component.html',
  styleUrl: './order-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderSummaryComponent {
  private readonly checkoutFacade = inject(CheckoutFacade);

  protected readonly orderSummary = this.checkoutFacade.orderSummary;
}
