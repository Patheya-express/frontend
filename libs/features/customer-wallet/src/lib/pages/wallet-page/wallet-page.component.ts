import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent, ErrorStateComponent, PaginationComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { CustomerWalletFacade } from '../../facades/customer-wallet.facade';

@Component({
  selector: 'lib-wallet-page',
  standalone: true,
  imports: [RouterLink, DatePipe, SkeletonComponent, EmptyStateComponent, ErrorStateComponent, PaginationComponent],
  templateUrl: './wallet-page.component.html',
  styleUrl: './wallet-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletPageComponent implements OnInit {
  protected readonly facade = inject(CustomerWalletFacade);

  ngOnInit(): void {
    void this.facade.loadBalance();
    void this.facade.loadTransactions();
  }

  protected retry(): void {
    void this.facade.loadTransactions(this.facade.page());
  }

  protected onPageChange(page: number): void {
    void this.facade.loadTransactions(page);
  }

  protected isCredit(amount: number): boolean {
    return amount >= 0;
  }

  protected typeLabel(type: string): string {
    return type
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
}
