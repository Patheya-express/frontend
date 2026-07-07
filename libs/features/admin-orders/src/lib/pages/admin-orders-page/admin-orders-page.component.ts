import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import type { AdminOrderResponseDto } from '@patheya-express-frontend/api-sdk';
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
import { AdminOrdersFacade } from '../../facades/admin-orders.facade';
import type { OrderStatusFilter } from '../../store/admin-orders.store';

const COLUMNS: DataTableColumn[] = [
  { key: 'order', label: 'Order' },
  { key: 'customer', label: 'Customer' },
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'deliveryPartner', label: 'Delivery Partner' },
  { key: 'status', label: 'Status' },
  { key: 'payment', label: 'Payment' },
  { key: 'total', label: 'Total' },
  { key: 'createdAt', label: 'Created' },
  { key: 'actions', label: 'Actions' },
];

const STATUS_OPTIONS: { value: OrderStatusFilter; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_TONES: Record<AdminOrderResponseDto['status'], StatusChipTone> = {
  PENDING: 'neutral',
  CONFIRMED: 'info',
  PREPARING: 'info',
  READY_FOR_PICKUP: 'success',
  OUT_FOR_DELIVERY: 'success',
  DELIVERED: 'success',
  CANCELLED: 'error',
};

const PAYMENT_TONES: Record<AdminOrderResponseDto['paymentStatus'], StatusChipTone> = {
  PENDING: 'neutral',
  PAID: 'success',
  FAILED: 'error',
  REFUNDED: 'info',
};

const TERMINAL_STATUSES: ReadonlyArray<AdminOrderResponseDto['status']> = ['DELIVERED', 'CANCELLED'];

type PendingActionType = 'cancel' | 'force-complete' | 'refund';

interface PendingAction {
  type: PendingActionType;
  order: AdminOrderResponseDto;
}

@Component({
  selector: 'lib-admin-orders-page',
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
  templateUrl: './admin-orders-page.component.html',
  styleUrl: './admin-orders-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrdersPageComponent implements OnInit {
  private readonly facade = inject(AdminOrdersFacade);

  protected readonly columns = COLUMNS;
  protected readonly statusOptions = STATUS_OPTIONS;

  protected readonly state = this.facade.state;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly processingId = this.facade.processingId;
  protected readonly actionError = this.facade.actionError;

  protected readonly pendingAction = signal<PendingAction | null>(null);
  protected readonly reassigningOrderId = signal<string | null>(null);
  protected readonly reassignInputValue = signal('');

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected retry(): void {
    void this.facade.refresh();
  }

  protected onSearch(value: string): void {
    this.facade.setSearch(value);
  }

  protected onRestaurantFilter(value: string): void {
    this.facade.setRestaurantFilter(value);
  }

  protected onStatusFilterChange(value: string): void {
    this.facade.setStatusFilter((value || null) as OrderStatusFilter | null);
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

  protected viewOrder(order: AdminOrderResponseDto): void {
    this.facade.selectOrder(order);
  }

  protected closeDetails(): void {
    this.facade.selectOrder(null);
  }

  protected canCancel(order: AdminOrderResponseDto): boolean {
    return !TERMINAL_STATUSES.includes(order.status);
  }

  protected canForceComplete(order: AdminOrderResponseDto): boolean {
    return !TERMINAL_STATUSES.includes(order.status);
  }

  protected canRefund(order: AdminOrderResponseDto): boolean {
    return order.paymentStatus === 'PAID';
  }

  protected canReassign(order: AdminOrderResponseDto): boolean {
    return !TERMINAL_STATUSES.includes(order.status);
  }

  protected requestAction(type: PendingActionType, order: AdminOrderResponseDto): void {
    this.pendingAction.set({ type, order });
  }

  protected cancelAction(): void {
    this.pendingAction.set(null);
  }

  protected async confirmAction(): Promise<void> {
    const pending = this.pendingAction();
    if (!pending) {
      return;
    }

    this.pendingAction.set(null);

    if (pending.type === 'cancel') {
      await this.facade.cancelOrder(pending.order.id);
    } else if (pending.type === 'force-complete') {
      await this.facade.forceCompleteOrder(pending.order.id);
    } else {
      await this.facade.refundOrder(pending.order.id);
    }
  }

  protected startReassign(order: AdminOrderResponseDto): void {
    this.reassigningOrderId.set(order.id);
    this.reassignInputValue.set(order.deliveryPartnerId ?? '');
  }

  protected cancelReassign(): void {
    this.reassigningOrderId.set(null);
    this.reassignInputValue.set('');
  }

  protected onReassignInputChange(value: string): void {
    this.reassignInputValue.set(value);
  }

  protected async confirmReassign(orderId: string): Promise<void> {
    const partnerId = this.reassignInputValue().trim();
    if (!partnerId) {
      return;
    }

    this.reassigningOrderId.set(null);
    this.reassignInputValue.set('');
    await this.facade.reassignDeliveryPartner(orderId, partnerId);
  }

  protected isProcessing(orderId: string): boolean {
    return this.processingId() === orderId;
  }

  protected customerName(order: AdminOrderResponseDto): string {
    return [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ');
  }

  protected deliveryPartnerName(order: AdminOrderResponseDto): string {
    if (!order.deliveryPartner) {
      return '—';
    }
    return [order.deliveryPartner.firstName, order.deliveryPartner.lastName].filter(Boolean).join(' ');
  }

  protected statusLabel(order: AdminOrderResponseDto): string {
    return STATUS_OPTIONS.find((option) => option.value === order.status)?.label ?? order.status;
  }

  protected statusTone(order: AdminOrderResponseDto): StatusChipTone {
    return STATUS_TONES[order.status];
  }

  protected paymentTone(order: AdminOrderResponseDto): StatusChipTone {
    return PAYMENT_TONES[order.paymentStatus];
  }

  protected formattedDate(value: string): string {
    return new Date(value).toLocaleString();
  }

  protected formattedAmount(value: number): string {
    return `₹${Number(value).toFixed(2)}`;
  }

  protected dialogTitle(): string {
    const pending = this.pendingAction();
    if (!pending) {
      return '';
    }

    if (pending.type === 'cancel') {
      return 'Cancel this order?';
    }

    if (pending.type === 'force-complete') {
      return 'Force complete this order?';
    }

    return 'Refund this order?';
  }

  protected dialogMessage(): string {
    const pending = this.pendingAction();
    if (!pending) {
      return '';
    }

    const number = pending.order.orderNumber;

    if (pending.type === 'cancel') {
      return `${number} will be cancelled immediately, regardless of its current status.`;
    }

    if (pending.type === 'force-complete') {
      return `${number} will be marked delivered directly, skipping the normal status pipeline.`;
    }

    return `${number} will be refunded through the original payment method.`;
  }

  protected dialogConfirmLabel(): string {
    const pending = this.pendingAction();
    if (!pending) {
      return 'Confirm';
    }

    if (pending.type === 'cancel') {
      return 'Cancel Order';
    }

    if (pending.type === 'force-complete') {
      return 'Force Complete';
    }

    return 'Refund';
  }

  protected dialogTone(): 'default' | 'danger' {
    return this.pendingAction()?.type !== 'force-complete' ? 'danger' : 'default';
  }

  protected isPendingBusy(): boolean {
    const pending = this.pendingAction();
    return !!pending && this.isProcessing(pending.order.id);
  }
}
