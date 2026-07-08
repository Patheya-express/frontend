import { Injectable, inject } from '@angular/core';
import { CustomerNotificationsStore } from '../store/customer-notifications.store';
import type { GetNotificationsParams } from '../services/customer-notifications.service';

type NotificationType = NonNullable<GetNotificationsParams['type']>;

@Injectable({ providedIn: 'root' })
export class CustomerNotificationsFacade {
  private readonly store = inject(CustomerNotificationsStore);

  readonly notifications = this.store.notifications;
  readonly total = this.store.total;
  readonly page = this.store.page;
  readonly totalPages = this.store.totalPages;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly unreadCount = this.store.unreadCount;
  readonly search = this.store.search;
  readonly typeFilter = this.store.typeFilter;
  readonly unreadOnly = this.store.unreadOnly;
  readonly dateFrom = this.store.dateFrom;
  readonly dateTo = this.store.dateTo;
  readonly realtimeConnected = this.store.realtimeConnected;

  loadUnreadCount(): Promise<void> {
    return this.store.loadUnreadCount();
  }

  loadNotifications(page?: number): Promise<void> {
    return this.store.loadNotifications(page);
  }

  setSearch(search: string): void {
    this.store.setSearch(search);
  }

  setTypeFilter(type: NotificationType | undefined): void {
    this.store.setTypeFilter(type);
  }

  setUnreadOnly(unreadOnly: boolean): void {
    this.store.setUnreadOnly(unreadOnly);
  }

  setDateRange(dateFrom: string | undefined, dateTo: string | undefined): void {
    this.store.setDateRange(dateFrom, dateTo);
  }

  clearFilters(): void {
    this.store.clearFilters();
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  markAsRead(id: string): Promise<void> {
    return this.store.markAsRead(id);
  }

  markAllAsRead(): Promise<void> {
    return this.store.markAllAsRead();
  }
}
