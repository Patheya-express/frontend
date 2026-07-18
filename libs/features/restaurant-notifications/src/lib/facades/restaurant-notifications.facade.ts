import { Injectable, inject } from '@angular/core';
import { RestaurantNotificationsStore } from '../store/restaurant-notifications.store';
import type { GetRestaurantNotificationsParams } from '../services/restaurant-notifications.service';

type NotificationType = NonNullable<GetRestaurantNotificationsParams['type']>;

@Injectable({ providedIn: 'root' })
export class RestaurantNotificationsFacade {
  private readonly store = inject(RestaurantNotificationsStore);

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
  readonly realtimeConnected = this.store.realtimeConnected;
  readonly restaurantNotificationTypes = this.store.restaurantNotificationTypes;

  /** Call once (e.g. app shell init) to keep the unread badge live for the whole session. */
  connectRealtime(): void {
    void this.store.connectRealtime();
  }

  disconnectRealtime(): void {
    this.store.disconnectRealtime();
  }

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
