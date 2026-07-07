import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import type { AdminPaymentResponseDto } from '@patheya-express-frontend/api-sdk';
import {
  ConfirmDialogComponent,
  DataTableComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PaginationComponent,
  SearchInputComponent,
  SkeletonComponent,
  StatusChipComponent,
  TableToolbarComponent,
  type DataTableColumn,
  type StatusChipTone,
} from '@patheya-express-frontend/ui';
import { AdminPaymentsFacade } from '../../facades/admin-payments.facade';
import type { PaymentMethodFilter, PaymentProviderFilter, PaymentStatusFilter } from '../../store/admin-payments.store';

const COLUMNS: DataTableColumn[] = [
  { key: 'payment', label: 'Payment' },
  { key: 'order', label: 'Order' },
  { key: 'customer', label: 'Customer' },
  { key: 'amount', label: 'Amount' },
  { key: 'provider', label: 'Provider' },
  { key: 'method', label: 'Method' },
  { key: 'status', label: 'Status' },
  { key: 'transaction', label: 'Transaction' },
  { key: 'createdAt', label: 'Created' },
  { key: 'actions', label: 'Actions' },
];

const STATUS_OPTIONS: { value: PaymentStatusFilter; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const STATUS_TONES: Record<AdminPaymentResponseDto['status'], StatusChipTone> = {
  PENDING: 'neutral',
  SUCCESS: 'success',
  FAILED: 'error',
  REFUNDED: 'info',
};

const PROVIDER_OPTIONS: { value: PaymentProviderFilter; label: string }[] = [
  { value: 'RAZORPAY', label: 'Razorpay' },
  { value: 'STRIPE', label: 'Stripe' },
];

const METHOD_OPTIONS: { value: PaymentMethodFilter; label: string }[] = [
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'NETBANKING', label: 'Netbanking' },
  { value: 'WALLET', label: 'Wallet' },
];

@Component({
  selector: 'lib-admin-payments-page',
  standalone: true,
  imports: [
    SkeletonComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    TableToolbarComponent,
    SearchInputComponent,
    DataTableComponent,
    StatusChipComponent,
    PaginationComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './admin-payments-page.component.html',
  styleUrl: './admin-payments-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPaymentsPageComponent implements OnInit {
  private readonly facade = inject(AdminPaymentsFacade);

  protected readonly columns = COLUMNS;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly providerOptions = PROVIDER_OPTIONS;
  protected readonly methodOptions = METHOD_OPTIONS;

  protected readonly state = this.facade.state;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly processingId = this.facade.processingId;
  protected readonly actionError = this.facade.actionError;

  protected readonly pendingRefund = signal<AdminPaymentResponseDto | null>(null);
  protected readonly copiedLabel = signal<string | null>(null);
  protected readonly scrollToTransaction = signal(false);

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected retry(): void {
    void this.facade.refresh();
  }

  protected onSearch(value: string): void {
    this.facade.setSearch(value);
  }

  protected onStatusFilterChange(value: string): void {
    this.facade.setStatusFilter((value || null) as PaymentStatusFilter | null);
  }

  protected onProviderFilterChange(value: string): void {
    this.facade.setProviderFilter((value || null) as PaymentProviderFilter | null);
  }

  protected onMethodFilterChange(value: string): void {
    this.facade.setMethodFilter((value || null) as PaymentMethodFilter | null);
  }

  protected onDateFromChange(value: string): void {
    this.facade.setDateRange(value, this.state().filters.dateTo);
  }

  protected onDateToChange(value: string): void {
    this.facade.setDateRange(this.state().filters.dateFrom, value);
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected viewTransaction(payment: AdminPaymentResponseDto): void {
    this.scrollToTransaction.set(true);
    this.facade.selectPayment(payment);
    queueMicrotask(() => {
      document.getElementById('admin-payments-transaction-section')?.scrollIntoView({ block: 'start' });
    });
  }

  protected closeDetails(): void {
    this.facade.selectPayment(null);
    this.scrollToTransaction.set(false);
  }

  protected canRefund(payment: AdminPaymentResponseDto): boolean {
    return payment.status === 'SUCCESS';
  }

  protected requestRefund(payment: AdminPaymentResponseDto): void {
    this.pendingRefund.set(payment);
  }

  protected cancelRefund(): void {
    this.pendingRefund.set(null);
  }

  protected async confirmRefund(): Promise<void> {
    const payment = this.pendingRefund();
    if (!payment) {
      return;
    }

    this.pendingRefund.set(null);
    await this.facade.refundPayment(payment.id);
  }

  protected isProcessing(paymentId: string): boolean {
    return this.processingId() === paymentId;
  }

  protected isPendingBusy(): boolean {
    const pending = this.pendingRefund();
    return !!pending && this.isProcessing(pending.id);
  }

  protected async copyPaymentId(payment: AdminPaymentResponseDto): Promise<void> {
    await navigator.clipboard.writeText(payment.id);
    this.flashCopied('payment');
  }

  protected async copyTransactionId(payment: AdminPaymentResponseDto): Promise<void> {
    if (!payment.providerPaymentId) {
      return;
    }
    await navigator.clipboard.writeText(payment.providerPaymentId);
    this.flashCopied('transaction');
  }

  private flashCopied(label: string): void {
    this.copiedLabel.set(label);
    setTimeout(() => {
      if (this.copiedLabel() === label) {
        this.copiedLabel.set(null);
      }
    }, 1500);
  }

  protected customerName(payment: AdminPaymentResponseDto): string {
    return [payment.customer.firstName, payment.customer.lastName].filter(Boolean).join(' ');
  }

  protected statusLabel(payment: AdminPaymentResponseDto): string {
    return STATUS_OPTIONS.find((option) => option.value === payment.status)?.label ?? payment.status;
  }

  protected statusTone(payment: AdminPaymentResponseDto): StatusChipTone {
    return STATUS_TONES[payment.status];
  }

  protected methodLabel(payment: AdminPaymentResponseDto): string {
    return payment.method
      ? (METHOD_OPTIONS.find((option) => option.value === payment.method)?.label ?? payment.method)
      : '—';
  }

  protected providerLabel(payment: AdminPaymentResponseDto): string {
    return PROVIDER_OPTIONS.find((option) => option.value === payment.provider)?.label ?? payment.provider;
  }

  protected formattedDate(value: string): string {
    return new Date(value).toLocaleDateString();
  }

  protected formattedDateTime(value: string): string {
    return new Date(value).toLocaleString();
  }

  protected formattedAmount(value: number): string {
    return `₹${Number(value).toFixed(2)}`;
  }
}
