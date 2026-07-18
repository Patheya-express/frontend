import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CustomerWalletFacade } from '@patheya-express-frontend/customer-wallet';
import { CheckoutFacade } from '../../facades/checkout.facade';
import type { PaymentMode } from '../../store/checkout.store';

@Component({
  selector: 'lib-payment-method-section',
  standalone: true,
  templateUrl: './payment-method-section.component.html',
  styleUrl: './payment-method-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethodSectionComponent implements OnInit {
  private readonly checkoutFacade = inject(CheckoutFacade);
  protected readonly walletFacade = inject(CustomerWalletFacade);

  protected readonly paymentMode = this.checkoutFacade.paymentMode;
  protected readonly useWallet = this.checkoutFacade.useWallet;

  ngOnInit(): void {
    void this.walletFacade.loadBalance();
  }

  protected select(mode: PaymentMode): void {
    this.checkoutFacade.setPaymentMode(mode);
  }

  protected onUseWalletToggle(checked: boolean): void {
    this.checkoutFacade.setUseWallet(checked);
  }
}
