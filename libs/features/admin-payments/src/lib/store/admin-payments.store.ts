import { Injectable, computed, inject, signal } from '@angular/core';
import type { AdminPaymentResponseDto } from '@patheya-express-frontend/api-sdk';
import { AdminPaymentsService } from '../services/admin-payments.service';

export type PaymentStatusFilter = AdminPaymentResponseDto['status'];
export type PaymentProviderFilter = AdminPaymentResponseDto['provider'];
export type PaymentMethodFilter = NonNullable<AdminPaymentResponseDto['method']>;

export interface AdminPaymentsFilters {
  search: string;
  status: PaymentStatusFilter | null;
  provider: PaymentProviderFilter | null;
  method: PaymentMethodFilter | null;
  dateFrom: string;
  dateTo: string;
}

export interface AdminPaymentsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminPaymentsState {
  payments: AdminPaymentResponseDto[];
  pagination: AdminPaymentsPagination;
  filters: AdminPaymentsFilters;
  selectedPayment: AdminPaymentResponseDto | null;
}

const DEFAULT_PAGINATION: AdminPaymentsPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
const DEFAULT_FILTERS: AdminPaymentsFilters = {
  search: '',
  status: null,
  provider: null,
  method: null,
  dateFrom: '',
  dateTo: '',
};

@Injectable({ providedIn: 'root' })
export class AdminPaymentsStore {
  private readonly adminPaymentsService = inject(AdminPaymentsService);

  private readonly _payments = signal<AdminPaymentResponseDto[]>([]);
  private readonly _pagination = signal<AdminPaymentsPagination>(DEFAULT_PAGINATION);
  private readonly _filters = signal<AdminPaymentsFilters>(DEFAULT_FILTERS);
  private readonly _selectedPayment = signal<AdminPaymentResponseDto | null>(null);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _processingId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly processingId = this._processingId.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly state = computed<AdminPaymentsState>(() => ({
    payments: this._payments(),
    pagination: this._pagination(),
    filters: this._filters(),
    selectedPayment: this._selectedPayment(),
  }));

  async loadPayments(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const filters = this._filters();
      const pagination = this._pagination();

      const response = await this.adminPaymentsService.getPayments({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search || undefined,
        status: filters.status ?? undefined,
        provider: filters.provider ?? undefined,
        method: filters.method ?? undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });

      this._payments.set(response.items);
      this._pagination.set({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: response.totalPages,
      });
    } catch {
      this._error.set('Unable to load payments. Please try again.');
      this._payments.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  setSearch(search: string): void {
    this._filters.update((filters) => ({ ...filters, search }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadPayments();
  }

  setStatusFilter(status: PaymentStatusFilter | null): void {
    this._filters.update((filters) => ({ ...filters, status }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadPayments();
  }

  setProviderFilter(provider: PaymentProviderFilter | null): void {
    this._filters.update((filters) => ({ ...filters, provider }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadPayments();
  }

  setMethodFilter(method: PaymentMethodFilter | null): void {
    this._filters.update((filters) => ({ ...filters, method }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadPayments();
  }

  setDateRange(dateFrom: string, dateTo: string): void {
    this._filters.update((filters) => ({ ...filters, dateFrom, dateTo }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadPayments();
  }

  setPage(page: number): void {
    this._pagination.update((pagination) => ({ ...pagination, page }));
    void this.loadPayments();
  }

  selectPayment(payment: AdminPaymentResponseDto | null): void {
    this._selectedPayment.set(payment);
  }

  /** The only mutating action on this page — refunds the payment's order via the reused, already-guarded admin endpoint. */
  refundPayment(paymentId: string, amount?: number, reason?: string): Promise<void> {
    return this.transitionPayment(
      paymentId,
      (payment) => ({ ...payment, status: 'REFUNDED' }),
      async (original) => {
        await this.adminPaymentsService.refundPayment(original.orderId, amount, reason);
        return { status: 'REFUNDED' };
      },
    );
  }

  dismissActionError(): void {
    this._actionError.set(null);
  }

  /**
   * Mirrors transitionUser()/transitionRestaurant()/transitionOrder()/transitionPartner():
   * optimistically apply the change, then reconcile with whatever fields the action call
   * reports back, or roll back to the original on failure. Payments only have one action
   * (refund), so this is the simplest of the five, but the same mechanism — no parallel
   * implementation.
   */
  private async transitionPayment(
    paymentId: string,
    applyOptimistic: (payment: AdminPaymentResponseDto) => AdminPaymentResponseDto,
    action: (original: AdminPaymentResponseDto) => Promise<Partial<AdminPaymentResponseDto>>,
  ): Promise<void> {
    const original = this._payments().find((payment) => payment.id === paymentId);
    if (!original) {
      return;
    }

    this._processingId.set(paymentId);
    this.replacePayment(paymentId, applyOptimistic(original));

    try {
      const changes = await action(original);
      const reconciled = { ...applyOptimistic(original), ...changes };

      this.replacePayment(paymentId, reconciled);

      if (this._selectedPayment()?.id === paymentId) {
        this._selectedPayment.set(reconciled);
      }

      this._actionError.set(null);
    } catch {
      this.replacePayment(paymentId, original);
      this._actionError.set('Unable to process the refund. Please try again.');
    } finally {
      this._processingId.set(null);
    }
  }

  private replacePayment(paymentId: string, replacement: AdminPaymentResponseDto): void {
    this._payments.update((payments) => payments.map((payment) => (payment.id === paymentId ? replacement : payment)));
  }
}
