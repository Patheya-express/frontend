import { Injectable, effect, inject, signal } from '@angular/core';
import type {
  OrderLocationResponseDto,
  OrderResponseDto,
  ProofPhotoResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { RealtimeSocketService } from '@patheya-express-frontend/core';
import { TERMINAL_ORDER_STATUSES } from '../constants/order-status.constants';
import { OrderDetailsService } from '../services/order-details.service';

const POLL_INTERVAL_MS = 15_000;

interface OrderStatusChangedPayload {
  orderId: string;
  status: OrderResponseDto['status'];
  updatedAt: string;
}

interface PickupPhotoUploadedPayload {
  orderId: string;
}

interface ArrivedAtRestaurantPayload {
  orderId: string;
  arrivedAt: string;
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
  /** Reference/evidence only — see ProofService.uploadPickupPhoto's doc comment. The customer can
   *  see it, but nothing in this store gates on the customer approving it (2026-09-16 revision
   *  removed that step; the photo no longer blocks the delivery OTP). */
  private readonly _pickupPhoto = signal<ProofPhotoResponseDto | null>(null);
  private readonly _arrivedAtRestaurantAt = signal<string | null>(null);

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private orderId = '';
  private unsubscribeStatus: (() => void) | null = null;
  private unsubscribeLocation: (() => void) | null = null;
  private unsubscribePickupPhoto: (() => void) | null = null;
  private unsubscribeArrived: (() => void) | null = null;

  readonly order = this._order.asReadonly();
  readonly restaurantName = this._restaurantName.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly location = this._location.asReadonly();
  readonly pickupPhoto = this._pickupPhoto.asReadonly();
  readonly arrivedAtRestaurantAt = this._arrivedAtRestaurantAt.asReadonly();
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

    // Without this, a logout while an order-tracking page is still mounted leaves `orderId` set,
    // and the effect above reacts to the logout-triggered socket disconnect by *starting* polling
    // (not stopping it) — silently polling a stale order with no active session, forever.
    inject(LogoutCleanupRegistry).register(() => this.stopTracking());
  }

  async loadOrder(orderId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const details = await this.orderDetailsService.getOrderDetails(orderId);
      this._order.set(details.order);
      this._restaurantName.set(details.restaurantName);
      await this.refreshLocationIfTrackable(details.order);
      await this.refreshPickupEvidenceIfTrackable(details.order);
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
    this.unsubscribePickupPhoto?.();
    this.unsubscribeArrived?.();
    this.unsubscribeStatus = null;
    this.unsubscribeLocation = null;
    this.unsubscribePickupPhoto = null;
    this.unsubscribeArrived = null;
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

    this.unsubscribePickupPhoto =
      this.realtimeSocketService.on<PickupPhotoUploadedPayload>(
        'pickup.photo.uploaded',
        (payload) => {
          if (payload.orderId === orderId) {
            void this.refreshPickupPhoto(orderId);
          }
        },
      );

    this.unsubscribeArrived =
      this.realtimeSocketService.on<ArrivedAtRestaurantPayload>(
        'delivery.arrived_at_restaurant',
        (payload) => {
          if (payload.orderId === orderId) {
            this._arrivedAtRestaurantAt.set(payload.arrivedAt);
          }
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
      await this.refreshPickupEvidenceIfTrackable(details.order);
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

  /**
   * Arrival can happen anytime the assignment is accepted and the order is READY_FOR_PICKUP
   * (before the photo/pickup even completes), so this fetches from READY_FOR_PICKUP onward —
   * one stage earlier than the pickup photo, which only exists once the rider has actually
   * uploaded it. Kept fetchable through DELIVERED so a customer revisiting a completed order's
   * page still sees the evidence they saw live.
   */
  private async refreshPickupEvidenceIfTrackable(
    order: OrderResponseDto,
  ): Promise<void> {
    const trackable =
      order.status === 'READY_FOR_PICKUP' ||
      order.status === 'OUT_FOR_DELIVERY' ||
      order.status === 'DELIVERED';

    if (!trackable) {
      this._pickupPhoto.set(null);
      this._arrivedAtRestaurantAt.set(null);
      return;
    }

    await Promise.all([
      this.refreshPickupPhoto(order.id),
      this.refreshArrivalStatus(order.id),
    ]);
  }

  private async refreshPickupPhoto(orderId: string): Promise<void> {
    try {
      const photo = await this.orderDetailsService.getPickupPhoto(orderId);
      this._pickupPhoto.set(photo);
    } catch {
      // Not uploaded yet (or not visible to this caller) — leave whatever was already shown.
    }
  }

  private async refreshArrivalStatus(orderId: string): Promise<void> {
    try {
      const status = await this.orderDetailsService.getArrivalStatus(orderId);
      this._arrivedAtRestaurantAt.set(status.arrivedAtRestaurantAt ?? null);
    } catch {
      // Leave whatever was already shown — the realtime event is the primary channel.
    }
  }
}
