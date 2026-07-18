import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CustomerWalletFacade } from '../../facades/customer-wallet.facade';

export interface WalletAppliedEvent {
  walletAmountApplied: number;
  remainingAmount: number;
}

/**
 * Checkout-embedded widget for the C9 mixed-payment feature — lets the customer apply some or
 * all of their wallet balance to the order they're about to pay for. Emits the server-computed
 * remaining amount so the checkout flow knows how much (if anything) still needs to go through
 * Razorpay.
 */
@Component({
  selector: 'lib-wallet-apply-widget',
  standalone: true,
  templateUrl: './wallet-apply-widget.component.html',
  styleUrl: './wallet-apply-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletApplyWidgetComponent implements OnInit {
  @Input({ required: true }) orderId!: string;
  @Input({ required: true }) orderTotal!: number;
  @Output() applied = new EventEmitter<WalletAppliedEvent>();

  protected readonly facade = inject(CustomerWalletFacade);
  protected readonly useWallet = signal(false);
  protected readonly appliedAmount = signal<number | null>(null);

  ngOnInit(): void {
    void this.facade.loadBalance();
  }

  protected get maxApplicable(): number {
    return Math.min(this.facade.balance(), this.orderTotal);
  }

  protected async onToggle(checked: boolean): Promise<void> {
    this.useWallet.set(checked);

    if (!checked) {
      this.appliedAmount.set(null);
      this.applied.emit({ walletAmountApplied: 0, remainingAmount: this.orderTotal });
      return;
    }

    const amount = this.maxApplicable;

    if (amount <= 0) {
      return;
    }

    const result = await this.facade.applyToOrder(this.orderId, amount);

    if (result) {
      this.appliedAmount.set(result.walletAmountApplied);
      this.applied.emit(result);
    }
  }
}
