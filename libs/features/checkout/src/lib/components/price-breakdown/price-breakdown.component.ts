import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CheckoutFacade } from '../../facades/checkout.facade';

@Component({
  selector: 'lib-price-breakdown',
  standalone: true,
  templateUrl: './price-breakdown.component.html',
  styleUrl: './price-breakdown.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceBreakdownComponent {
  private readonly checkoutFacade = inject(CheckoutFacade);

  protected readonly orderSummary = this.checkoutFacade.orderSummary;
}
