import { Injectable, inject } from '@angular/core';
import {
  WalletService,
  type ApplyWalletToOrderResponseDto,
  type PaginatedWalletTransactionsResponseDto,
  type ReferralSummaryResponseDto,
} from '@patheya-express-frontend/api-sdk';

interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

@Injectable({ providedIn: 'root' })
export class CustomerWalletService {
  private readonly walletService = inject(WalletService);

  async getBalance(): Promise<number> {
    const response = await this.walletService.walletControllerGetBalance();
    return unwrap(response).balance;
  }

  async getTransactions(page: number, limit: number): Promise<PaginatedWalletTransactionsResponseDto> {
    const response = await this.walletService.walletControllerGetTransactions({ page, limit });
    return unwrap(response);
  }

  async getReferralSummary(): Promise<ReferralSummaryResponseDto> {
    const response = await this.walletService.walletControllerGetReferralSummary();
    return unwrap(response);
  }

  async applyToOrder(orderId: string, amount: number): Promise<ApplyWalletToOrderResponseDto> {
    const response = await this.walletService.walletControllerApplyToOrder({ body: { orderId, amount } });
    return unwrap(response);
  }
}
