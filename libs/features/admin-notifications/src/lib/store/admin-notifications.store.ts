import { Injectable, computed, inject, signal } from '@angular/core';
import type { AdminNotificationResponseDto } from '@patheya-express-frontend/api-sdk';
import { AdminNotificationsService } from '../services/admin-notifications.service';

export type NotificationTypeFilter = AdminNotificationResponseDto['type'];
export type NotificationChannelFilter = AdminNotificationResponseDto['channel'];
export type NotificationStatusFilter = AdminNotificationResponseDto['status'];

export interface AdminNotificationsFilters {
  search: string;
  type: NotificationTypeFilter | null;
  channel: NotificationChannelFilter | null;
  status: NotificationStatusFilter | null;
  recipient: string;
  dateFrom: string;
  dateTo: string;
}

export interface AdminNotificationsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminNotificationsState {
  notifications: AdminNotificationResponseDto[];
  pagination: AdminNotificationsPagination;
  filters: AdminNotificationsFilters;
  selectedNotification: AdminNotificationResponseDto | null;
}

const DEFAULT_PAGINATION: AdminNotificationsPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
const DEFAULT_FILTERS: AdminNotificationsFilters = {
  search: '',
  type: null,
  channel: null,
  status: null,
  recipient: '',
  dateFrom: '',
  dateTo: '',
};

@Injectable({ providedIn: 'root' })
export class AdminNotificationsStore {
  private readonly adminNotificationsService = inject(AdminNotificationsService);

  private readonly _notifications = signal<AdminNotificationResponseDto[]>([]);
  private readonly _pagination = signal<AdminNotificationsPagination>(DEFAULT_PAGINATION);
  private readonly _filters = signal<AdminNotificationsFilters>(DEFAULT_FILTERS);
  private readonly _selectedNotification = signal<AdminNotificationResponseDto | null>(null);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly state = computed<AdminNotificationsState>(() => ({
    notifications: this._notifications(),
    pagination: this._pagination(),
    filters: this._filters(),
    selectedNotification: this._selectedNotification(),
  }));

  async loadNotifications(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const filters = this._filters();
      const pagination = this._pagination();

      const response = await this.adminNotificationsService.getNotifications({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search || undefined,
        type: filters.type ?? undefined,
        channel: filters.channel ?? undefined,
        status: filters.status ?? undefined,
        recipient: filters.recipient || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });

      this._notifications.set(response.items);
      this._pagination.set({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: response.totalPages,
      });
    } catch {
      this._error.set('Unable to load notifications. Please try again.');
      this._notifications.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  setSearch(search: string): void {
    this._filters.update((filters) => ({ ...filters, search }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadNotifications();
  }

  setTypeFilter(type: NotificationTypeFilter | null): void {
    this._filters.update((filters) => ({ ...filters, type }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadNotifications();
  }

  setChannelFilter(channel: NotificationChannelFilter | null): void {
    this._filters.update((filters) => ({ ...filters, channel }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadNotifications();
  }

  setStatusFilter(status: NotificationStatusFilter | null): void {
    this._filters.update((filters) => ({ ...filters, status }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadNotifications();
  }

  setRecipientFilter(recipient: string): void {
    this._filters.update((filters) => ({ ...filters, recipient }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadNotifications();
  }

  setDateRange(dateFrom: string, dateTo: string): void {
    this._filters.update((filters) => ({ ...filters, dateFrom, dateTo }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadNotifications();
  }

  setPage(page: number): void {
    this._pagination.update((pagination) => ({ ...pagination, page }));
    void this.loadNotifications();
  }

  selectNotification(notification: AdminNotificationResponseDto | null): void {
    this._selectedNotification.set(notification);
  }

  /**
   * Enqueues delivery via the provider-agnostic retry pipeline, then reloads the current page
   * so the list reflects the notification's state at enqueue time. The processor resolves the
   * outcome asynchronously — per the no-polling requirement, seeing it move to SENT/FAILED
   * again requires the admin to refresh.
   */
  async retryNotification(id: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await this.adminNotificationsService.retryNotification(id);
      await this.loadNotifications();

      const refreshed = this._notifications().find((notification) => notification.id === id);
      if (refreshed && this._selectedNotification()?.id === id) {
        this._selectedNotification.set(refreshed);
      }
    } catch {
      this._error.set('Unable to retry this notification. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }
}
