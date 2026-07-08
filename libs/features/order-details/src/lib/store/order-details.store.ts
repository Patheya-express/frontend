import { Injectable, effect, inject, signal } from '@angular/core';
import type { OrderLocationResponseDto, OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { RealtimeSocketService } from '@patheya-express-frontend/core';
import { OrderDetailsService } from '../services/order-details.service';

const TERMINAL_ORDER_STATUSES: ReadonlyArray<OrderResponseDto['status']> = ['DELIVERED', 'CANCELLED'];
const POLL_INTERVAL_MS = 15_000;

interface OrderStatusChangedPayload {
  orderId: string;
  status: OrderResponseDto['status'];
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class OrderDetailsStore {
  private readonly orderDetailsService = inject(OrderDetailsService);
  private readonly realtimeSocketService = inject(RealtimeSocketService);

  private readonly _order = signal<OrderResponseDto | null>(null);
  private readonly _restaurantName = signal<string | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _location = signal<OrderLocationResponseDto | null>(null);

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private orderId = '';
  private unsubscribeStatus: (() => void) | null = null;
  private unsubscribeLocation: (() => void) | null = null;

  readonly order = this._order.asReadonly();
  readonly restaurantName = this._restaurantName.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly location = this._location.asReadonly();
  /** True once the realtime socket is connected — the page can rely on push updates instead of polling. */
  readonly realtimeConnected = this.realtimeSocketService.connected;

  constructor() {
    // Realtime is the primary channel; polling only runs as a fallback for when the socket is
    // unavailable (never connects, or drops mid-session) — matches the "no polling if realtime
    // is available, fall back to polling when disconnected" requirement.
    effect(() => {
      const connected = this.realtimeSocketService.connected();

      if (!this.orderId) {
        return;
      }

      if (connected) {
        this.stopPolling();
      } else {
        this.startPollingInterval();
      }
    });
  }

  async loadOrder(orderId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const details = await this.orderDetailsService.getOrderDetails(orderId);
      this._order.set(details.order);
      this._restaurantName.set(details.restaurantName);
      await this.refreshLocationIfTrackable(details.order);
    } catch {
      this._error.set('Unable to load this order. It may not exist or you may not have access to it.');
      this._order.set(null);
      this._restaurantName.set(null);
    } finally {
      this._loading.set(false);
    }
  }

  /** Loads immediately, joins the order's realtime room for push updates, and falls back to polling if the socket isn't connected. */
  startTracking(orderId: string): void {
    this.orderId = orderId;
    void this.loadOrder(orderId);
    void this.joinRoom(orderId);

    if (!this.realtimeSocketService.connected()) {
      this.startPollingInterval();
    }
  }

  stopTracking(): void {
    this.stopPolling();
    this.unsubscribeStatus?.();
    this.unsubscribeLocation?.();
    this.unsubscribeStatus = null;
    this.unsubscribeLocation = null;
    this.orderId = '';
  }

  private async joinRoom(orderId: string): Promise<void> {
    const joined = await this.realtimeSocketService.joinRoom(`order:${orderId}`);

    if (!joined || this.orderId !== orderId) {
      return;
    }

    this.unsubscribeStatus = this.realtimeSocketService.on<OrderStatusChangedPayload>(
      'order.status.changed',
      (payload) => {
        if (payload.orderId === orderId) {
          void this.loadOrder(orderId);
        }
      },
    );

    this.unsubscribeLocation = this.realtimeSocketService.on<OrderLocationResponseDto>(
      'tracking.location',
      (payload) => {
        this._location.set(payload);
      },
    );
  }

  private startPollingInterval(): void {
    if (this.pollHandle) {
      return;
    }

    this.pollHandle = setInterval(() => void this.refreshSilently(), POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private async refreshSilently(): Promise<void> {
    const current = this._order();

    if (current && TERMINAL_ORDER_STATUSES.includes(current.status)) {
      this.stopPolling();
      return;
    }

    try {
      const details = await this.orderDetailsService.getOrderDetails(this.orderId);
      this._order.set(details.order);
      this._restaurantName.set(details.restaurantName);
      this._error.set(null);
      await this.refreshLocationIfTrackable(details.order);
    } catch {
      // A transient background refresh failure shouldn't blank out an already-loaded order;
      // the next successful poll tick recovers silently.
    }
  }

  private async refreshLocationIfTrackable(order: OrderResponseDto): Promise<void> {
    if (order.status !== 'OUT_FOR_DELIVERY') {
      this._location.set(null);
      return;
    }

    try {
      const location = await this.orderDetailsService.getOrderLocation(order.id);
      this._location.set(location);
    } catch {
      // A failed location fetch shouldn't break the rest of the order-details page.
    }
  }
}
