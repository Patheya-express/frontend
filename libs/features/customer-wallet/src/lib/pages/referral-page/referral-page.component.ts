import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerWalletFacade } from '../../facades/customer-wallet.facade';

@Component({
  selector: 'lib-referral-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './referral-page.component.html',
  styleUrl: './referral-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralPageComponent implements OnInit {
  protected readonly facade = inject(CustomerWalletFacade);
  protected readonly copied = signal(false);

  ngOnInit(): void {
    void this.facade.loadReferralSummary();
  }

  protected async copyCode(): Promise<void> {
    const code = this.facade.referralCode();

    if (!code || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(code);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
