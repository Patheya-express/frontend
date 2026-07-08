import { Injectable, effect, inject, signal } from '@angular/core';
import type { NotificationResponseDto } from '@patheya-express-frontend/api-sdk';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { RealtimeSocketService } from '@patheya-express-frontend/core';
import { CustomerNotificationsService, type GetNotificationsParams } from '../services/customer-notifications.service';

const PAGE_SIZE = 20;

type NotificationType = NonNullable<GetNotificationsParams['type']>;

@Injectable({ providedIn: 'root' })
export class CustomerNotificationsStore {
  private readonly notificationsService = inject(CustomerNotificationsService);
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
  private readonly _dateFrom = signal<string | undefined>(undefined);
  private readonly _dateTo = signal<string | undefined>(undefined);

  /** True once the list has been loaded at least once this session — gates live-insert vs. badge-only updates. */
  private hasLoadedList = false;
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
  readonly dateFrom = this._dateFrom.asReadonly();
  readonly dateTo = this._dateTo.asReadonly();
  readonly realtimeConnected = this.realtimeSocketService.connected;

  constructor() {
    // Joins the authenticated user's own realtime room once per session — lives for the whole
    // app (not tied to the notification-center page), so the header badge keeps updating no
    // matter which page the user is on.
    effect(() => {
      if (this.authFacade.isAuthenticated()) {
        void this.connectRealtime();
      }
    });
  }

  private async connectRealtime(): Promise<void> {
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
      (notification) => this.handleIncomingNotification(notification),
    );
  }

  private handleIncomingNotification(notification: NotificationResponseDto): void {
    this._unreadCount.update((count) => count + 1);

    // Only splice into the in-memory list if it's already been loaded this session (i.e. the
    // notification center has been opened) — otherwise this would render a partial page-1 list
    // the next time it's opened. The badge-only update above always happens regardless.
    if (this.hasLoadedList && this._page() === 1) {
      this._notifications.update((current) => [notification, ...current]);
      this._total.update((total) => total + 1);
    }
  }

  async loadUnreadCount(): Promise<void> {
    try {
      const result = await this.notificationsService.getUnreadCount();
      this._unreadCount.set(result.count);
    } catch {
      // Keep the previous count on failure — better a stale count than a flash to zero.
    }
  }

  async loadNotifications(page = 1): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const result = await this.notificationsService.getMyNotifications({
        page,
        limit: PAGE_SIZE,
        search: this._search() || undefined,
        type: this._type(),
        unreadOnly: this._unreadOnly() || undefined,
        dateFrom: this._dateFrom(),
        dateTo: this._dateTo(),
      });

      this._notifications.set(result.items);
      this._total.set(result.total);
      this._page.set(result.page);
      this._totalPages.set(result.totalPages);
      this.hasLoadedList = true;
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

  setDateRange(dateFrom: string | undefined, dateTo: string | undefined): void {
    this._dateFrom.set(dateFrom);
    this._dateTo.set(dateTo);
    void this.loadNotifications(1);
  }

  clearFilters(): void {
    this._search.set('');
    this._type.set(undefined);
    this._unreadOnly.set(false);
    this._dateFrom.set(undefined);
    this._dateTo.set(undefined);
    void this.loadNotifications(1);
  }

  setPage(page: number): void {
    void this.loadNotifications(page);
  }

  async markAsRead(id: string): Promise<void> {
    const target = this._notifications().find((n) => n.id === id);
    const wasUnread = !!target && target.status !== 'READ';

    this._notifications.update((list) =>
      list.map((n) => (n.id === id ? { ...n, status: 'READ' as const, readAt: new Date().toISOString() } : n)),
    );

    if (wasUnread) {
      this._unreadCount.update((count) => Math.max(0, count - 1));
    }

    try {
      await this.notificationsService.markAsRead(id);
    } catch {
      // Reconcile with the server rather than leaving an inconsistent optimistic state.
      void this.loadNotifications(this._page());
      void this.loadUnreadCount();
    }
  }

  async markAllAsRead(): Promise<void> {
    const previousList = this._notifications();
    const previousCount = this._unreadCount();

    this._notifications.update((list) => list.map((n) => ({ ...n, status: 'READ' as const })));
    this._unreadCount.set(0);

    try {
      await this.notificationsService.markAllAsRead();
    } catch {
      this._notifications.set(previousList);
      this._unreadCount.set(previousCount);
    }
  }
}
