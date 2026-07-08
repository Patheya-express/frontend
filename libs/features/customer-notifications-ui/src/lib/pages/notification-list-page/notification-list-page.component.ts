import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import type { NotificationResponseDto } from '@patheya-express-frontend/api-sdk';
import { CustomerNotificationsFacade } from '@patheya-express-frontend/customer-notifications';
import { EmptyStateComponent, ErrorStateComponent, PaginationComponent, SearchInputComponent, SkeletonComponent } from '@patheya-express-frontend/ui';

type NotificationType = NotificationResponseDto['type'];

const TYPE_OPTIONS: { value: NotificationType | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'ORDER_PLACED', label: 'Order placed' },
  { value: 'ORDER_STATUS_CHANGED', label: 'Order updates' },
  { value: 'DELIVERY_PARTNER_ASSIGNED', label: 'Delivery partner' },
  { value: 'OFFER', label: 'Offers' },
  { value: 'GENERAL', label: 'General' },
];

interface DeepLinkTarget {
  commands: (string | number)[];
  fragment?: string;
}

/**
 * Maps a notification's metadata (referenceType/referenceId) to an in-app route. Kept local to
 * this feature rather than in shared-core's NavigationService, which is scoped to external
 * maps/geo links, not app routing.
 */
function resolveNotificationTarget(notification: NotificationResponseDto): DeepLinkTarget {
  const metadata = notification.metadata as { referenceType?: string; referenceId?: string } | undefined;

  if (!metadata?.referenceType || !metadata.referenceId) {
    return { commands: ['/notifications', notification.id] };
  }

  switch (metadata.referenceType) {
    case 'ORDER':
      return { commands: ['/orders', metadata.referenceId] };
    case 'REVIEW':
    case 'RESTAURANT':
      return { commands: ['/restaurants', metadata.referenceId], fragment: 'reviews' };
    case 'OFFER':
      return { commands: ['/offers', metadata.referenceId] };
    default:
      return { commands: ['/notifications', notification.id] };
  }
}

@Component({
  selector: 'lib-notification-list-page',
  standalone: true,
  imports: [DatePipe, SkeletonComponent, EmptyStateComponent, ErrorStateComponent, SearchInputComponent, PaginationComponent],
  templateUrl: './notification-list-page.component.html',
  styleUrl: './notification-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationListPageComponent implements OnInit {
  protected readonly facade = inject(CustomerNotificationsFacade);
  private readonly router = inject(Router);

  protected readonly typeOptions = TYPE_OPTIONS;

  ngOnInit(): void {
    void this.facade.loadNotifications(1);
  }

  protected retry(): void {
    void this.facade.loadNotifications(this.facade.page());
  }

  protected onSearch(value: string): void {
    this.facade.setSearch(value);
  }

  protected onTypeChange(value: string): void {
    this.facade.setTypeFilter(value ? (value as NonNullable<NotificationType>) : undefined);
  }

  protected onUnreadOnlyToggle(checked: boolean): void {
    this.facade.setUnreadOnly(checked);
  }

  protected onDateFromChange(value: string): void {
    this.facade.setDateRange(value || undefined, this.facade.dateTo());
  }

  protected onDateToChange(value: string): void {
    this.facade.setDateRange(this.facade.dateFrom(), value || undefined);
  }

  protected clearFilters(): void {
    this.facade.clearFilters();
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected isUnread(notification: NotificationResponseDto): boolean {
    return notification.status !== 'READ';
  }

  protected async open(notification: NotificationResponseDto): Promise<void> {
    if (this.isUnread(notification)) {
      void this.facade.markAsRead(notification.id);
    }

    const target = resolveNotificationTarget(notification);
    await this.router.navigate(target.commands, target.fragment ? { fragment: target.fragment } : undefined);
  }

  protected markAsRead(event: Event, notification: NotificationResponseDto): void {
    event.stopPropagation();
    void this.facade.markAsRead(notification.id);
  }

  protected markAllAsRead(): void {
    void this.facade.markAllAsRead();
  }
}
