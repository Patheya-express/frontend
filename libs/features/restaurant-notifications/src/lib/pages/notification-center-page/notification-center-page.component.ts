import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { NotificationResponseDto } from '@patheya-express-frontend/api-sdk';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  PaginationComponent,
  SearchInputComponent,
  SkeletonComponent,
  StatusChipComponent,
} from '@patheya-express-frontend/ui';
import { RestaurantNotificationsFacade } from '../../facades/restaurant-notifications.facade';

const TYPE_LABELS: Partial<Record<string, string>> = {
  NEW_ORDER_FOR_RESTAURANT: 'New Order',
  ORDER_CANCELLED_FOR_RESTAURANT: 'Order Cancelled',
  REFUND_FOR_RESTAURANT: 'Refund',
  CUSTOMER_MESSAGE_FOR_RESTAURANT: 'Customer Message',
};

@Component({
  selector: 'lib-notification-center-page',
  standalone: true,
  imports: [DatePipe, SearchInputComponent, PaginationComponent, SkeletonComponent, ErrorStateComponent, EmptyStateComponent, StatusChipComponent],
  templateUrl: './notification-center-page.component.html',
  styleUrl: './notification-center-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationCenterPageComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(RestaurantNotificationsFacade);
  private readonly router = inject(Router);

  protected readonly typeLabels = TYPE_LABELS;

  ngOnInit(): void {
    this.facade.connectRealtime();
    void this.facade.loadUnreadCount();
    void this.facade.loadNotifications(1);
  }

  ngOnDestroy(): void {
    this.facade.disconnectRealtime();
  }

  protected onSearch(term: string): void {
    this.facade.setSearch(term);
  }

  protected onTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.facade.setTypeFilter((value || undefined) as never);
  }

  protected onUnreadOnlyChange(event: Event): void {
    this.facade.setUnreadOnly((event.target as HTMLInputElement).checked);
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected markAllAsRead(): void {
    void this.facade.markAllAsRead();
  }

  protected openNotification(notification: NotificationResponseDto): void {
    if (!notification.readAt) {
      void this.facade.markAsRead(notification.id);
    }

    const referenceType = (notification.metadata as Record<string, unknown> | undefined)?.[
      'referenceType'
    ];

    if (referenceType === 'ORDER') {
      void this.router.navigate(['/orders']);
    }
  }

  protected retry(): void {
    void this.facade.loadNotifications();
  }
}
