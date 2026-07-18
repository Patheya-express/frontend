import { Injectable, inject } from '@angular/core';
import { CustomerWalletStore } from '../store/customer-wallet.store';

@Injectable({ providedIn: 'root' })
export class CustomerWalletFacade {
  private readonly store = inject(CustomerWalletStore);

  readonly balance = this.store.balance;
  readonly balanceLoading = this.store.balanceLoading;

  readonly transactions = this.store.transactions;
  readonly total = this.store.total;
  readonly page = this.store.page;
  readonly totalPages = this.store.totalPages;
  readonly transactionsLoading = this.store.transactionsLoading;
  readonly transactionsError = this.store.transactionsError;

  readonly referralCode = this.store.referralCode;
  readonly totalReferred = this.store.totalReferred;
  readonly totalRewarded = this.store.totalRewarded;
  readonly totalEarned = this.store.totalEarned;
  readonly referralLoading = this.store.referralLoading;

  readonly applying = this.store.applying;
  readonly applyError = this.store.applyError;

  loadBalance(): Promise<void> {
    return this.store.loadBalance();
  }

  loadTransactions(page?: number): Promise<void> {
    return this.store.loadTransactions(page);
  }

  loadReferralSummary(): Promise<void> {
    return this.store.loadReferralSummary();
  }

  applyToOrder(orderId: string, amount: number) {
    return this.store.applyToOrder(orderId, amount);
  }
}
