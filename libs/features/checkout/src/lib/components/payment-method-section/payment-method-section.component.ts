import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CheckoutFacade } from '../../facades/checkout.facade';
import type { PaymentMode } from '../../store/checkout.store';

@Component({
  selector: 'lib-payment-method-section',
  standalone: true,
  templateUrl: './payment-method-section.component.html',
  styleUrl: './payment-method-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethodSectionComponent {
  private readonly checkoutFacade = inject(CheckoutFacade);

  protected readonly paymentMode = this.checkoutFacade.paymentMode;

  protected select(mode: PaymentMode): void {
    this.checkoutFacade.setPaymentMode(mode);
  }
}
