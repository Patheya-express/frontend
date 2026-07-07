import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import type { AdminNotificationResponseDto } from '@patheya-express-frontend/api-sdk';
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
import { AdminNotificationsFacade } from '../../facades/admin-notifications.facade';
import type {
  NotificationChannelFilter,
  NotificationStatusFilter,
  NotificationTypeFilter,
} from '../../store/admin-notifications.store';

const COLUMNS: DataTableColumn[] = [
  { key: 'createdAt', label: 'Created' },
  { key: 'type', label: 'Type' },
  { key: 'channel', label: 'Channel' },
  { key: 'recipient', label: 'Recipient' },
  { key: 'subject', label: 'Subject' },
  { key: 'status', label: 'Status' },
  { key: 'attempts', label: 'Attempts' },
  { key: 'actions', label: 'Actions' },
];

const TYPE_OPTIONS: { value: NotificationTypeFilter; label: string }[] = [
  { value: 'ORDER_PLACED', label: 'Order Placed' },
  { value: 'ORDER_STATUS_CHANGED', label: 'Order Status Changed' },
  { value: 'DELIVERY_PARTNER_ASSIGNED', label: 'Delivery Partner Assigned' },
  { value: 'GENERAL', label: 'General' },
];

const CHANNEL_OPTIONS: { value: NotificationChannelFilter; label: string }[] = [
  { value: 'PUSH', label: 'Push' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'IN_APP', label: 'In-App' },
];

const STATUS_OPTIONS: { value: NotificationStatusFilter; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'READ', label: 'Read' },
];

const STATUS_TONES: Record<AdminNotificationResponseDto['status'], StatusChipTone> = {
  PENDING: 'neutral',
  SENT: 'success',
  FAILED: 'error',
  READ: 'info',
};

interface DeliveryTimelineEntry {
  label: string;
  timestamp: string;
}

@Component({
  selector: 'lib-admin-notifications-page',
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
  templateUrl: './admin-notifications-page.component.html',
  styleUrl: './admin-notifications-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminNotificationsPageComponent implements OnInit {
  private readonly facade = inject(AdminNotificationsFacade);

  protected readonly columns = COLUMNS;
  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly channelOptions = CHANNEL_OPTIONS;
  protected readonly statusOptions = STATUS_OPTIONS;

  protected readonly state = this.facade.state;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;

  protected readonly pendingRetryId = signal<string | null>(null);

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected retry(): void {
    void this.facade.refresh();
  }

  protected onSearch(value: string): void {
    this.facade.setSearch(value);
  }

  protected onTypeFilterChange(value: string): void {
    this.facade.setTypeFilter((value || null) as NotificationTypeFilter | null);
  }

  protected onChannelFilterChange(value: string): void {
    this.facade.setChannelFilter((value || null) as NotificationChannelFilter | null);
  }

  protected onStatusFilterChange(value: string): void {
    this.facade.setStatusFilter((value || null) as NotificationStatusFilter | null);
  }

  protected onRecipientFilter(value: string): void {
    this.facade.setRecipientFilter(value);
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

  protected viewNotification(notification: AdminNotificationResponseDto): void {
    this.facade.selectNotification(notification);
  }

  protected closeDetails(): void {
    this.facade.selectNotification(null);
  }

  protected canRetry(notification: AdminNotificationResponseDto): boolean {
    return notification.status === 'FAILED';
  }

  protected requestRetry(notification: AdminNotificationResponseDto): void {
    this.pendingRetryId.set(notification.id);
  }

  protected cancelRetry(): void {
    this.pendingRetryId.set(null);
  }

  protected async confirmRetry(): Promise<void> {
    const id = this.pendingRetryId();
    if (!id) {
      return;
    }

    this.pendingRetryId.set(null);
    await this.facade.retryNotification(id);
  }

  protected typeLabel(notification: AdminNotificationResponseDto): string {
    return TYPE_OPTIONS.find((option) => option.value === notification.type)?.label ?? notification.type;
  }

  protected channelLabel(notification: AdminNotificationResponseDto): string {
    return CHANNEL_OPTIONS.find((option) => option.value === notification.channel)?.label ?? notification.channel;
  }

  protected statusLabel(notification: AdminNotificationResponseDto): string {
    return STATUS_OPTIONS.find((option) => option.value === notification.status)?.label ?? notification.status;
  }

  protected statusTone(notification: AdminNotificationResponseDto): StatusChipTone {
    return STATUS_TONES[notification.status];
  }

  protected recipientName(notification: AdminNotificationResponseDto): string {
    return [notification.recipient.firstName, notification.recipient.lastName].filter(Boolean).join(' ');
  }

  protected formattedDate(value: string): string {
    return new Date(value).toLocaleString();
  }

  protected formattedMetadata(notification: AdminNotificationResponseDto): string | null {
    if (!notification.metadata || Object.keys(notification.metadata).length === 0) {
      return null;
    }
    return JSON.stringify(notification.metadata, null, 2);
  }

  /** Derived from timestamps only — there is no separate delivery-attempt history table. */
  protected deliveryTimeline(notification: AdminNotificationResponseDto): DeliveryTimelineEntry[] {
    const entries: DeliveryTimelineEntry[] = [{ label: 'Created', timestamp: notification.createdAt }];

    if (notification.sentAt) {
      entries.push({ label: 'Sent', timestamp: notification.sentAt });
    }

    if (notification.readAt) {
      entries.push({ label: 'Read', timestamp: notification.readAt });
    }

    if (notification.updatedAt !== notification.createdAt) {
      entries.push({ label: 'Last Updated', timestamp: notification.updatedAt });
    }

    return entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
}
