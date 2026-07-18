import { Injectable, effect, inject, signal } from '@angular/core';
import type { WalletTransactionResponseDto } from '@patheya-express-frontend/api-sdk';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { RealtimeSocketService } from '@patheya-express-frontend/core';
import { CustomerWalletService } from '../services/customer-wallet.service';

const PAGE_SIZE = 20;

@Injectable({ providedIn: 'root' })
export class CustomerWalletStore {
  private readonly walletService = inject(CustomerWalletService);
  private readonly realtimeSocketService = inject(RealtimeSocketService);
  private readonly authFacade = inject(AuthFacade);

  private readonly _balance = signal(0);
  private readonly _balanceLoading = signal(false);

  private readonly _transactions = signal<WalletTransactionResponseDto[]>([]);
  private readonly _total = signal(0);
  private readonly _page = signal(1);
  private readonly _totalPages = signal(1);
  private readonly _transactionsLoading = signal(false);
  private readonly _transactionsError = signal<string | null>(null);

  private readonly _referralCode = signal('');
  private readonly _totalReferred = signal(0);
  private readonly _totalRewarded = signal(0);
  private readonly _totalEarned = signal(0);
  private readonly _referralLoading = signal(false);

  private readonly _applying = signal(false);
  private readonly _applyError = signal<string | null>(null);

  private joinedUserRoom = false;

  readonly balance = this._balance.asReadonly();
  readonly balanceLoading = this._balanceLoading.asReadonly();

  readonly transactions = this._transactions.asReadonly();
  readonly total = this._total.asReadonly();
  readonly page = this._page.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly transactionsLoading = this._transactionsLoading.asReadonly();
  readonly transactionsError = this._transactionsError.asReadonly();

  readonly referralCode = this._referralCode.asReadonly();
  readonly totalReferred = this._totalReferred.asReadonly();
  readonly totalRewarded = this._totalRewarded.asReadonly();
  readonly totalEarned = this._totalEarned.asReadonly();
  readonly referralLoading = this._referralLoading.asReadonly();

  readonly applying = this._applying.asReadonly();
  readonly applyError = this._applyError.asReadonly();

  constructor() {
    // Joins the user's realtime room once so the balance updates live wherever the wallet is
    // shown, no matter what triggered the credit/debit (order delivery, admin adjustment, etc).
    effect(() => {
      if (this.authFacade.isAuthenticated()) {
        void this.connectRealtime();
      }
    });
  }

  private async connectRealtime(): Promise<void> {
    if (this.joinedUserRoom) {
      return;
    }

    const userId = this.authFacade.user()?.id;

    if (!userId) {
      return;
    }

    const joined = await this.realtimeSocketService.joinRoom(`user:${userId}`);

    if (!joined || this.joinedUserRoom) {
      return;
    }

    this.joinedUserRoom = true;

    this.realtimeSocketService.on<{ balance: number }>('wallet.balance.changed', (payload) => {
      this._balance.set(payload.balance);
      void this.loadTransactions(1);
    });
  }

  async loadBalance(): Promise<void> {
    this._balanceLoading.set(true);

    try {
      this._balance.set(await this.walletService.getBalance());
    } finally {
      this._balanceLoading.set(false);
    }
  }

  async loadTransactions(page = 1): Promise<void> {
    this._transactionsLoading.set(true);
    this._transactionsError.set(null);

    try {
      const result = await this.walletService.getTransactions(page, PAGE_SIZE);

      this._transactions.set(result.items);
      this._total.set(result.total);
      this._page.set(result.page);
      this._totalPages.set(result.totalPages);
    } catch {
      this._transactionsError.set('Unable to load wallet transactions. Please try again.');
    } finally {
      this._transactionsLoading.set(false);
    }
  }

  async loadReferralSummary(): Promise<void> {
    this._referralLoading.set(true);

    try {
      const summary = await this.walletService.getReferralSummary();

      this._referralCode.set(summary.referralCode);
      this._totalReferred.set(summary.totalReferred);
      this._totalRewarded.set(summary.totalRewarded);
      this._totalEarned.set(summary.totalEarned);
    } finally {
      this._referralLoading.set(false);
    }
  }

  async applyToOrder(orderId: string, amount: number): Promise<{ walletAmountApplied: number; remainingAmount: number } | null> {
    this._applying.set(true);
    this._applyError.set(null);

    try {
      const result = await this.walletService.applyToOrder(orderId, amount);

      this._balance.update((balance) => Math.max(0, balance - result.walletAmountApplied));

      return result;
    } catch {
      this._applyError.set('Unable to apply wallet balance to this order. Please try again.');
      return null;
    } finally {
      this._applying.set(false);
    }
  }
}
