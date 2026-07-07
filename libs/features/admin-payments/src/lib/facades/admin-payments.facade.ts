import { Injectable, inject } from '@angular/core';
import type { AdminPaymentResponseDto } from '@patheya-express-frontend/api-sdk';
import {
  AdminPaymentsStore,
  type PaymentMethodFilter,
  type PaymentProviderFilter,
  type PaymentStatusFilter,
} from '../store/admin-payments.store';

@Injectable({ providedIn: 'root' })
export class AdminPaymentsFacade {
  private readonly store = inject(AdminPaymentsStore);

  readonly state = this.store.state;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly processingId = this.store.processingId;
  readonly actionError = this.store.actionError;

  /** Loads the first page of payments. Call once on page init. */
  initialize(): Promise<void> {
    return this.store.loadPayments();
  }

  refresh(): Promise<void> {
    return this.store.loadPayments();
  }

  setSearch(search: string): void {
    this.store.setSearch(search);
  }

  setStatusFilter(status: PaymentStatusFilter | null): void {
    this.store.setStatusFilter(status);
  }

  setProviderFilter(provider: PaymentProviderFilter | null): void {
    this.store.setProviderFilter(provider);
  }

  setMethodFilter(method: PaymentMethodFilter | null): void {
    this.store.setMethodFilter(method);
  }

  setDateRange(dateFrom: string, dateTo: string): void {
    this.store.setDateRange(dateFrom, dateTo);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  selectPayment(payment: AdminPaymentResponseDto | null): void {
    this.store.selectPayment(payment);
  }

  refundPayment(paymentId: string, amount?: number, reason?: string): Promise<void> {
    return this.store.refundPayment(paymentId, amount, reason);
  }

  dismissActionError(): void {
    this.store.dismissActionError();
  }
}
