import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { MobilePlatformService, RealtimeSocketService } from '@patheya-express-frontend/core';
import { isTerminalOrderStatus } from '../constants/order-status.constants';
import { ActiveOrdersService } from '../services/active-orders.service';

/** Floating tracker rule — never more than this many rows, newest order first. */
export const MAX_TRACKED_ORDERS = 3;

/** Wide enough that every order the customer could plausibly still have active is on page 1 of
 *  GET /orders/me, which sorts newest-first with no status filter (see
 *  OrdersRepository.findCustomerOrders) — without pulling their whole order history just to find
 *  a handful of live ones. */
const ACTIVE_ORDER_FETCH_LIMIT = 20;

interface OrderStatusChangedPayload {
  orderId: string;
  status: OrderResponseDto['status'];
}

function byNewestFirst(a: OrderResponseDto, b: OrderResponseDto): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/**
 * Single source of truth for the signed-in customer's active (non-terminal) orders — backs the
 * Live Orders floating tracker. Reuses the existing customer-orders endpoint
 * (ActiveOrdersService → OrdersService.ordersControllerGetCustomerOrders, the same GET /orders/me
 * the Orders list page itself calls) for the initial snapshot, and the existing per-order
 * Socket.IO room (`order:<id>`, the same room OrderDetailsStore joins from the order-details page)
 * for live status updates. No second realtime connection, no polling: status changes are applied
 * as targeted patches to already-known orders, not a refetch.
 */
@Injectable({ providedIn: 'root' })
export class LiveOrdersStore {
  private readonly activeOrdersService = inject(ActiveOrdersService);
  private readonly realtimeSocketService = inject(RealtimeSocketService);

  private readonly _orders = signal<OrderResponseDto[]>([]);

  private readonly joinedOrderIds = new Set<string>();
  private unsubscribeStatusListener: (() => void) | null = null;
  private hasInitialized = false;

  /** Every currently-known active order, newest first. Deliberately uncapped — "only 3 slots,
   *  promote the next-newest when one clears" is a *view* rule (see `trackedOrders`), not a
   *  reason to discard orders 4+ from state. */
  readonly activeOrders = computed(() => [...this._orders()].sort(byNewestFirst));
  /** What the floating tracker actually renders. */
  readonly trackedOrders = computed(() => this.activeOrders().slice(0, MAX_TRACKED_ORDERS));

  constructor() {
    inject(LogoutCleanupRegistry).register(() => this.reset());

    // One-shot resync on app resume — not polling. RealtimeSocketService.resyncOnResume already
    // restores the connection and replays room membership on its own; this just re-fetches the
    // order list itself in case a status changed while the app was backgrounded/disconnected.
    inject(MobilePlatformService).onResume(() => {
      if (this.hasInitialized) {
        void this.refresh();
      }
    });

    // Joins the realtime room for any active order that doesn't have one yet — covers the initial
    // fetch, upsertOrder() (order just placed), and refresh() (app resume) through one reactive
    // path instead of each call site remembering to join rooms itself.
    //
    // Floating-tracker resync bug fix: the join itself is async (a socket round trip), so a
    // status-changed event for one of these orders can legitimately arrive — and be silently
    // dropped by Socket.IO, which never replays missed room broadcasts — in the window between
    // "we fetched this order's status" and "we finished joining its room" (very plausible right
    // after placing an order: cold room join racing a restaurant that accepts within seconds).
    // Once every newly-joined room for this tick has settled, this triggers exactly one corrective
    // `refresh()` (reusing the existing GET /orders/me + mergeOrders path, not a new fetch
    // mechanism) so any status that changed during the join window is picked up — a bounded,
    // one-shot resync, not a recurring poll.
    effect(() => {
      const newlyJoined: Promise<unknown>[] = [];

      for (const order of this._orders()) {
        if (!this.joinedOrderIds.has(order.id)) {
          this.joinedOrderIds.add(order.id);
          newlyJoined.push(this.realtimeSocketService.joinRoom(`order:${order.id}`));
        }
      }

      if (newlyJoined.length > 0) {
        void Promise.all(newlyJoined).then(() => this.refresh());
      }
    });
  }

  /** Loads the initial active-order snapshot and wires up realtime. Idempotent — call once per authenticated session. */
  async initialize(): Promise<void> {
    if (this.hasInitialized) {
      return;
    }
    this.hasInitialized = true;

    this.ensureStatusListener();
    await this.refresh();
  }

  /** Re-fetches the active-order snapshot from the server. */
  async refresh(): Promise<void> {
    try {
      const result = await this.activeOrdersService.getRecentOrders(ACTIVE_ORDER_FETCH_LIMIT);
      const active = result.items.filter((order) => !isTerminalOrderStatus(order.status));
      this.mergeOrders(active);
    } catch {
      // A failed sync leaves whatever was already known in place — the tracker doesn't disappear
      // outright on a transient network error; the next successful refresh/status event recovers it.
    }
  }

  /**
   * Injects a just-placed order directly into state, ahead of any refetch — avoids the
   * "navigate Home → Home loads orders → new order momentarily missing" race, since the order the
   * customer just placed is already known in full from the checkout response itself.
   */
  upsertOrder(order: OrderResponseDto): void {
    if (isTerminalOrderStatus(order.status)) {
      return;
    }

    this.mergeOrders([order]);
    this.ensureStatusListener();
  }

  private mergeOrders(orders: OrderResponseDto[]): void {
    if (orders.length === 0) {
      return;
    }

    this._orders.update((current) => {
      const byId = new Map(current.map((order) => [order.id, order]));
      for (const order of orders) {
        byId.set(order.id, order);
      }
      return [...byId.values()];
    });
  }

  private ensureStatusListener(): void {
    if (this.unsubscribeStatusListener) {
      return;
    }

    this.unsubscribeStatusListener = this.realtimeSocketService.on<OrderStatusChangedPayload>(
      'order.status.changed',
      (payload) => this.applyStatusChange(payload),
    );
  }

  private applyStatusChange(payload: OrderStatusChangedPayload): void {
    const current = this._orders();
    const existing = current.find((order) => order.id === payload.orderId);

    if (!existing) {
      // Not one of our currently-known active orders (e.g. outside the fetch window) — nothing to update.
      return;
    }

    if (isTerminalOrderStatus(payload.status)) {
      this._orders.set(current.filter((order) => order.id !== payload.orderId));
      return;
    }

    this._orders.set(
      current.map((order) => (order.id === payload.orderId ? { ...order, status: payload.status } : order)),
    );
  }

  private reset(): void {
    this._orders.set([]);
    this.joinedOrderIds.clear();
    this.unsubscribeStatusListener?.();
    this.unsubscribeStatusListener = null;
    this.hasInitialized = false;
  }
}
