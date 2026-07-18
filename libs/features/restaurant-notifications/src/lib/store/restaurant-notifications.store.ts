import { Injectable, computed, inject, signal } from '@angular/core';
import type { NotificationResponseDto } from '@patheya-express-frontend/api-sdk';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { RealtimeSocketService } from '@patheya-express-frontend/core';
import {
  RestaurantNotificationsFeatureService,
  type GetRestaurantNotificationsParams,
} from '../services/restaurant-notifications.service';

const PAGE_SIZE = 20;

type NotificationType = NonNullable<GetRestaurantNotificationsParams['type']>;

@Injectable({ providedIn: 'root' })
export class RestaurantNotificationsStore {
  private readonly service = inject(RestaurantNotificationsFeatureService);
  private readonly realtimeSocketService = inject(RealtimeSocketService);
  private readonly authFacade = inject(AuthFacade);

  private readonly _notifications = signal<NotificationResponseDto[]>([]);
  private readonly _total = signal(0);
  private readonly _page = signal(1);
  private readonly _totalPages = signal(1);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _unreadCount = signal(0);

  private readonly _search = signal('');
  private readonly _type = signal<NotificationType | undefined>(undefined);
  private readonly _unreadOnly = signal(false);

  private joinedUserRoom = false;
  private unsubscribeNotification: (() => void) | null = null;

  readonly notifications = this._notifications.asReadonly();
  readonly total = this._total.asReadonly();
  readonly page = this._page.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();
  readonly search = this._search.asReadonly();
  readonly typeFilter = this._type.asReadonly();
  readonly unreadOnly = this._unreadOnly.asReadonly();
  readonly realtimeConnected = this.realtimeSocketService.connected;

  readonly restaurantNotificationTypes = computed<NotificationType[]>(() => [
    'NEW_ORDER_FOR_RESTAURANT',
    'ORDER_CANCELLED_FOR_RESTAURANT',
    'REFUND_FOR_RESTAURANT',
    'CUSTOMER_MESSAGE_FOR_RESTAURANT',
  ]);

  /** Joins this user's own realtime room once per session so the unread badge stays live no
   *  matter which page is open — mirrors CustomerNotificationsStore. */
  async connectRealtime(): Promise<void> {
    if (this.joinedUserRoom) {
      return;
    }

    const userId = this.authFacade.user()?.id;
    if (!userId) {
      return;
    }

    const joined = await this.realtimeSocketService.joinRoom(`user:${userId}`);

    if (!joined || this.joinedUserRoom) {
      return;
    }

    this.joinedUserRoom = true;

    this.unsubscribeNotification = this.realtimeSocketService.on<NotificationResponseDto>(
      'notification',
      () => {
        this._unreadCount.update((count) => count + 1);

        if (this._page() === 1) {
          void this.loadNotifications(1);
        }
      },
    );
  }

  disconnectRealtime(): void {
    this.unsubscribeNotification?.();
    this.unsubscribeNotification = null;
    this.joinedUserRoom = false;
  }

  async loadUnreadCount(): Promise<void> {
    try {
      const { count } = await this.service.getUnreadCount();
      this._unreadCount.set(count);
    } catch {
      // Non-critical background refresh — badge just stays at its last known value.
    }
  }

  async loadNotifications(page = this._page()): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await this.service.getMyNotifications({
        page,
        limit: PAGE_SIZE,
        search: this._search() || undefined,
        type: this._type(),
        unreadOnly: this._unreadOnly() || undefined,
      });

      this._notifications.set(response.items);
      this._total.set(response.total);
      this._page.set(response.page);
      this._totalPages.set(response.totalPages);
    } catch {
      this._error.set('Unable to load notifications. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  setSearch(search: string): void {
    this._search.set(search);
    void this.loadNotifications(1);
  }

  setTypeFilter(type: NotificationType | undefined): void {
    this._type.set(type);
    void this.loadNotifications(1);
  }

  setUnreadOnly(unreadOnly: boolean): void {
    this._unreadOnly.set(unreadOnly);
    void this.loadNotifications(1);
  }

  clearFilters(): void {
    this._search.set('');
    this._type.set(undefined);
    this._unreadOnly.set(false);
    void this.loadNotifications(1);
  }

  setPage(page: number): void {
    void this.loadNotifications(page);
  }

  async markAsRead(id: string): Promise<void> {
    try {
      const updated = await this.service.markAsRead(id);
      this._notifications.set(this._notifications().map((n) => (n.id === id ? updated : n)));

      if (updated.readAt) {
        this._unreadCount.update((count) => Math.max(0, count - 1));
      }
    } catch {
      // Marking read is a convenience action — a failure here shouldn't surface a page-level error.
    }
  }

  async markAllAsRead(): Promise<void> {
    try {
      await this.service.markAllAsRead();
      this._unreadCount.set(0);
      await this.loadNotifications(this._page());
    } catch {
      // Same — non-critical, next load will reflect the true state.
    }
  }
}
