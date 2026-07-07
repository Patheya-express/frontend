import { Injectable, inject } from '@angular/core';
import type { AdminNotificationResponseDto } from '@patheya-express-frontend/api-sdk';
import {
  AdminNotificationsStore,
  type NotificationChannelFilter,
  type NotificationStatusFilter,
  type NotificationTypeFilter,
} from '../store/admin-notifications.store';

@Injectable({ providedIn: 'root' })
export class AdminNotificationsFacade {
  private readonly store = inject(AdminNotificationsStore);

  readonly state = this.store.state;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  /** Loads the first page of notifications. Call once on page init. */
  initialize(): Promise<void> {
    return this.store.loadNotifications();
  }

  refresh(): Promise<void> {
    return this.store.loadNotifications();
  }

  setSearch(search: string): void {
    this.store.setSearch(search);
  }

  setTypeFilter(type: NotificationTypeFilter | null): void {
    this.store.setTypeFilter(type);
  }

  setChannelFilter(channel: NotificationChannelFilter | null): void {
    this.store.setChannelFilter(channel);
  }

  setStatusFilter(status: NotificationStatusFilter | null): void {
    this.store.setStatusFilter(status);
  }

  setRecipientFilter(recipient: string): void {
    this.store.setRecipientFilter(recipient);
  }

  setDateRange(dateFrom: string, dateTo: string): void {
    this.store.setDateRange(dateFrom, dateTo);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  selectNotification(notification: AdminNotificationResponseDto | null): void {
    this.store.selectNotification(notification);
  }

  retryNotification(id: string): Promise<void> {
    return this.store.retryNotification(id);
  }
}
