import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { CartFacade } from '@patheya-express-frontend/cart';
import { MobilePlatformService } from '@patheya-express-frontend/core';
import {
  MOBILE_MOTION_DURATIONS_MS,
  OrderStatusBadgeComponent,
  prefersReducedMotion,
  SwipeDirective,
  type MobileSwipeEvent,
} from '@patheya-express-frontend/ui';
import { orderStatusMessage } from '../../constants/order-status-message.constants';
import { LiveOrdersFacade } from '../../facades/live-orders.facade';

const DEFAULT_RESTAURANT_LABEL = 'Your order';

/** Routes where the tracker would be redundant clutter: mid-checkout (placing a *new* order), and
 *  the orders list/detail pages, which already show this same information in full. */
const HIDDEN_ROUTE_PREFIXES = ['/checkout', '/orders'];

function isHiddenRoute(url: string): boolean {
  const path = url.split('?')[0];
  return HIDDEN_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

const ORDER_STAGE_ICONS: Partial<Record<OrderResponseDto['status'], string>> = {
  PENDING: '🧾',
  CONFIRMED: '🧾',
  PREPARING: '👨‍🍳',
  READY_FOR_PICKUP: '📦',
  OUT_FOR_DELIVERY: '🛵',
};
const DEFAULT_ORDER_ICON = '🧾';

/**
 * Compact, single-order floating tracker for the customer's active orders — lives in the app
 * shell (see app.html), above the bottom navigation, on every route (subject to
 * HIDDEN_ROUTE_PREFIXES above). Shows exactly one order at a time with pagination dots; the
 * customer swipes/drags horizontally (or uses the dots/arrow keys) to move between up to 3 tracked
 * orders. Purely a view over LiveOrdersFacade.trackedOrders (already newest-first, already capped
 * at 3, already realtime) plus one small piece of UI-only state — which of those orders is
 * currently displayed — this component owns no order data or sorting logic of its own.
 *
 * Content: restaurant name (from OrderResponseDto.restaurantName — already joined server-side by
 * the same GET /orders/me call LiveOrdersStore uses, see ActiveOrdersService; falls back to
 * DEFAULT_RESTAURANT_LABEL only for the brief window right after the customer's own just-placed
 * order is upserted, before restaurantName is known — see restaurantLabel()'s doc comment) +
 * OrderStatusBadgeComponent (unchanged, existing status labels) on the primary line, and a status
 * message on the secondary line. No ETA is ever shown: OrderResponseDto carries no ETA field, and
 * the app's one real ETA source (OrderLocationResponseDto.etaMinutes, the order-details page's
 * "Arriving in ~N min") comes from a separate per-order tracking API call this tracker must not
 * make — so the secondary line is always the status message, never a fabricated ETA.
 */
@Component({
  selector: 'lib-live-orders-floating-tracker',
  standalone: true,
  imports: [RouterLink, OrderStatusBadgeComponent, SwipeDirective],
  templateUrl: './live-orders-floating-tracker.component.html',
  styleUrl: './live-orders-floating-tracker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveOrdersFloatingTrackerComponent {
  private readonly liveOrdersFacade = inject(LiveOrdersFacade);
  private readonly cartFacade = inject(CartFacade);
  private readonly router = inject(Router);

  /** Native Android/iOS shell only — pushes the tracker above AppShellComponent's fixed bottom tab
   *  bar (see app-shell.component.scss); on web there's no fixed tab bar to clear. Same convention
   *  CartCheckoutBarComponent already uses for the same reason. */
  protected readonly isNative = inject(MobilePlatformService).isNative();

  /** Newest-first, capped at 3 — the authoritative order data. Never mutated or re-sorted here. */
  protected readonly orders = this.liveOrdersFacade.trackedOrders;

  /**
   * UI-only presentation state — which of `orders()` is currently displayed in the collapsed bar.
   * Tracked by id (not index) so a terminal-order removal or a promotion elsewhere in the array
   * can never silently point this at the wrong order. This is the *only* state this component
   * owns; it is never written back into LiveOrdersFacade/Store.
   */
  private readonly selectedOrderId = signal<string | null>(null);

  /** Snapshot of `orders()` ids as of the end of the last effect run — used to tell "a genuinely
   *  new order just arrived at the front" apart from "the same orders, one of them patched or
   *  reordered by promotion", and to know where a just-removed selected order used to sit. */
  private previousOrderIds: string[] = [];

  protected readonly selectedIndex = computed(() =>
    this.orders().findIndex((order) => order.id === this.selectedOrderId()),
  );

  /** Falls back to the newest order (index 0) for the one render tick between `orders()` gaining
   *  its first item and the constructor effect below formally selecting it — never renders "no
   *  selection" while `orders()` is non-empty. */
  protected readonly selectedOrder = computed<OrderResponseDto | null>(() => {
    const list = this.orders();
    const index = this.selectedIndex();
    return index >= 0 ? list[index] : (list[0] ?? null);
  });

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** CartCheckoutBarComponent floats in this exact same slot when the cart has items — this stacks
   *  the tracker above it instead of overlapping (see the component's own hidden-route filter for
   *  why the two rarely disagree on visibility for the same route). */
  protected readonly aboveCartBar = computed(() => this.cartFacade.totalItems() > 0);

  /** The real visibility condition. Renamed from the old `visible` so that name is free for the
   *  DOM-presence signal below, which lags one leave-animation behind this on the way out. */
  protected readonly shouldShow = computed(
    () => this.orders().length > 0 && !isHiddenRoute(this.currentUrl()),
  );

  /** Last non-null `selectedOrder()`, kept around purely so the leave animation has something to
   *  render — `orders()` (and so `selectedOrder()`) may already be empty by the time the deferred
   *  removal below actually happens, e.g. once the tracked order turns DELIVERED and the store
   *  drops it. Never read by `selectedOrderId`'s own management effect above; this is animation
   *  support only, not part of the selection state machine. */
  protected readonly displayOrder = signal<OrderResponseDto | null>(null);

  /**
   * Gates the template's `@if`, one leave-animation duration behind `shouldShow` on the way out so
   * a leave animation (see the template) actually gets to play before Angular removes the element
   * — a plain `@if (shouldShow())` would destroy it mid-frame instead. Immediate on the way in.
   * Same pattern as `CartCheckoutBarComponent`'s own floating bar, which shares this exact
   * "conditionally rendered, no transition" shape. Skips the delay under `prefers-reduced-motion`.
   */
  protected readonly visible = signal(false);
  private hideTimeout?: ReturnType<typeof setTimeout>;

  /** Guards the click that follows a drag/swipe pointer sequence — see onPointerDown/onSwiped/onBarClick. */
  protected justSwiped = false;

  constructor() {
    // Keeps `selectedOrderId` valid and stable as `orders()` changes, without ever overwriting it
    // on a plain status patch (the common case). Three situations, in order:
    //  1. Nothing selected yet (first load) → select the newest order.
    //  2. Selection still exists → leave it alone, UNLESS a genuinely new order just became the
    //     newest (front of the array) — e.g. the customer's own just-placed order — in which case
    //     jump to it, matching the previous stacked tracker's "newest is always visible" behavior.
    //  3. Selection no longer exists (it turned DELIVERED/CANCELLED and the store dropped it) →
    //     re-select the order that was immediately *before* it in the old order (falling back to
    //     the new first item if the removed order was already first), never the item that slides
    //     into its old slot — that would otherwise silently skip forward past the customer's
    //     current position.
    effect(() => {
      const current = this.orders();
      const currentIds = current.map((order) => order.id);
      const previousIds = this.previousOrderIds;
      const selected = untracked(() => this.selectedOrderId());

      if (current.length === 0) {
        if (selected !== null) {
          this.selectedOrderId.set(null);
        }
        this.previousOrderIds = currentIds;
        return;
      }

      if (selected === null) {
        this.selectedOrderId.set(current[0].id);
        this.previousOrderIds = currentIds;
        return;
      }

      // Checked before "does the selection still exist": a new order can arrive at the front in
      // the very same store update that pushes the previously-selected order out of the top-3
      // window entirely (not terminal — just no longer newest enough to make the cut) — that's
      // still "a new order arrived", not "the selected order disappeared", and should jump to the
      // new order rather than fall into the position-based reselection below.
      const newestId = current[0].id;
      const newestIsBrandNew = !previousIds.includes(newestId);

      if (newestIsBrandNew && newestId !== selected) {
        this.selectedOrderId.set(newestId);
        this.previousOrderIds = currentIds;
        return;
      }

      if (currentIds.includes(selected)) {
        this.previousOrderIds = currentIds;
        return;
      }

      const oldIndex = previousIds.indexOf(selected);
      const targetIndex = Math.min(Math.max(oldIndex - 1, 0), current.length - 1);
      this.selectedOrderId.set(current[targetIndex].id);
      this.previousOrderIds = currentIds;
    });

    effect(() => {
      const order = this.selectedOrder();
      if (order) {
        this.displayOrder.set(order);
      }
    });

    effect(() => {
      if (this.shouldShow()) {
        clearTimeout(this.hideTimeout);
        this.visible.set(true);
        return;
      }

      if (!this.visible()) {
        return;
      }

      if (prefersReducedMotion()) {
        this.visible.set(false);
        return;
      }

      this.hideTimeout = setTimeout(() => this.visible.set(false), MOBILE_MOTION_DURATIONS_MS.fast);
    });
  }

  protected icon(status: OrderResponseDto['status']): string {
    return ORDER_STAGE_ICONS[status] ?? DEFAULT_ORDER_ICON;
  }

  /**
   * `restaurantName` is populated by GET /orders/me for every order LiveOrdersStore's initial
   * fetch and resume-refresh load — the only gap is the customer's *own* just-placed order,
   * upserted straight from the POST /orders response (see PlaceOrderSectionComponent), which does
   * not join the restaurant relation and so has no restaurantName until the next refresh. Rather
   * than leave the primary line blank (or invent a name), that one transient case falls back to a
   * generic, honestly-non-specific label — never a guessed restaurant name.
   */
  protected restaurantLabel(order: OrderResponseDto): string {
    return order.restaurantName?.trim() || DEFAULT_RESTAURANT_LABEL;
  }

  protected statusMessage(status: OrderResponseDto['status']): string {
    return orderStatusMessage(status);
  }

  protected select(orderId: string): void {
    this.selectedOrderId.set(orderId);
  }

  protected selectNext(event?: Event): void {
    event?.preventDefault();
    const list = this.orders();
    const index = this.selectedIndex();
    if (index < 0 || list.length === 0) {
      return;
    }
    this.selectedOrderId.set(list[Math.min(index + 1, list.length - 1)].id);
  }

  protected selectPrevious(event?: Event): void {
    event?.preventDefault();
    const list = this.orders();
    const index = this.selectedIndex();
    if (index < 0 || list.length === 0) {
      return;
    }
    this.selectedOrderId.set(list[Math.max(index - 1, 0)].id);
  }

  /** A fresh pointer gesture starting on the bar always clears any stale guard from a previous
   *  swipe — see onBarClick's doc comment for why the guard can't simply be consumed once. */
  protected onPointerDown(): void {
    this.justSwiped = false;
  }

  protected onSwiped(event: MobileSwipeEvent): void {
    if (event.direction === 'left') {
      this.selectNext();
    } else if (event.direction === 'right') {
      this.selectPrevious();
    } else {
      return;
    }
    this.justSwiped = true;
  }

  /**
   * The bar is both a real `<a routerLink>` (tap-to-open) and a swipe target (drag-to-switch) —
   * a mouse/touch drag that ends back over the same element can still produce a native `click`
   * afterwards depending on the browser, which would wrongly navigate on what the customer meant
   * as a swipe. `justSwiped` (set by onSwiped, cleared by the next onPointerDown) suppresses
   * exactly that one click without affecting a genuine tap, which never sets it in the first place.
   */
  protected onBarClick(event: MouseEvent): void {
    if (this.justSwiped) {
      event.preventDefault();
      this.justSwiped = false;
    }
  }
}
