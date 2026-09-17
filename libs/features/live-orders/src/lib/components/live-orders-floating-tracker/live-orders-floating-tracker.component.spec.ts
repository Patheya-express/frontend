import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { CartFacade } from '@patheya-express-frontend/cart';
import { MobilePlatformService } from '@patheya-express-frontend/core';
import { LiveOrdersFloatingTrackerComponent } from './live-orders-floating-tracker.component';
import { LiveOrdersFacade } from '../../facades/live-orders.facade';

/**
 * Coverage for the collapsed single-order carousel (see the component's own doc comment for the
 * UX and content sourcing) and its customer-facing content (restaurant name / status / status
 * message — TC-D0x below). Capping at 3 / newest-first sorting / promotion / logout-clear /
 * no-duplicate-listener are LiveOrdersStore's responsibility, not this component's, and are
 * already covered by live-orders.store.spec.ts (TC05/06 caps at 3, TC07/08 sort, TC13 promotion,
 * TC18 logout, TC21/23 single listener) — this component only ever renders whatever
 * LiveOrdersFacade.trackedOrders hands it, so it is deliberately not re-tested here with a mock
 * that fakes more than 3 items.
 */
function makeOrder(
  id: string,
  status: OrderResponseDto['status'] = 'PREPARING',
  restaurantName = `Restaurant ${id}`,
): OrderResponseDto {
  return { id, orderNumber: `PE-${id}`, status, restaurantName } as OrderResponseDto;
}

describe('LiveOrdersFloatingTrackerComponent', () => {
  let trackedOrders: ReturnType<typeof signal<OrderResponseDto[]>>;
  let totalItems: ReturnType<typeof signal<number>>;

  async function createFixture() {
    // Defensive reset — TC-D03 below creates several fixtures in one test (one per status), and
    // TestBed refuses to reconfigure an already-instantiated module.
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LiveOrdersFloatingTrackerComponent],
      providers: [
        // A wildcard route is enough for Router.navigateByUrl to resolve during the "hides on a
        // given route" tests below — no real routing/outlet needed, just URL recognition.
        provideRouter([{ path: '**', component: LiveOrdersFloatingTrackerComponent }]),
        { provide: LiveOrdersFacade, useValue: { trackedOrders } },
        { provide: CartFacade, useValue: { totalItems } },
        { provide: MobilePlatformService, useValue: { isNative: () => false } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LiveOrdersFloatingTrackerComponent);
    await settle(fixture);
    return fixture;
  }

  /** Flushes the constructor's selection-syncing `effect()` — Angular's effect scheduler runs on
   *  its own microtask/tick, not synchronously with the signal write that triggered it. Same
   *  pattern CheckoutStore's own effect-loop regression spec uses (checkout.store.spec.ts's
   *  `settle`) and live-orders.store.spec.ts's own `settle`. */
  async function settle(fixture: { detectChanges(): void; whenStable(): Promise<void> }, rounds = 4): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      TestBed.tick();
      fixture.detectChanges();
      await Promise.resolve();
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function instance(fixture: { componentInstance: unknown }) {
    return fixture.componentInstance as LiveOrdersFloatingTrackerComponent & {
      onSwiped(event: { direction: 'up' | 'down' | 'left' | 'right'; distancePx: number; velocityPxPerMs: number }): void;
      selectNext(event?: Event): void;
      selectPrevious(event?: Event): void;
      select(orderId: string): void;
    };
  }

  function bar(fixture: { nativeElement: HTMLElement }): HTMLAnchorElement {
    return fixture.nativeElement.querySelector('.live-orders-tracker__bar') as HTMLAnchorElement;
  }

  beforeEach(() => {
    trackedOrders = signal<OrderResponseDto[]>([]);
    totalItems = signal(0);
  });

  it('TC-C16/TC01 — renders nothing when there are no active orders', async () => {
    const fixture = await createFixture();
    expect(fixture.nativeElement.querySelector('.live-orders-tracker')).toBeNull();
  });

  it('TC-C01/TC-D01/TC-D12 — one active order renders a single compact bar showing the restaurant name', async () => {
    trackedOrders.set([makeOrder('1')]);
    const fixture = await createFixture();

    const bars = fixture.nativeElement.querySelectorAll('.live-orders-tracker__bar');
    expect(bars.length).toBe(1);
    expect(bars[0].textContent).toContain('Restaurant 1');
    // Compact: exactly two text lines inside the bar (primary + message), no order item list/price/address.
    expect(fixture.nativeElement.querySelector('.live-orders-tracker__message')).not.toBeNull();
  });

  it('TC-D01 — the order number is no longer part of the visible primary content', async () => {
    trackedOrders.set([makeOrder('1')]);
    const fixture = await createFixture();

    expect(bar(fixture).textContent).not.toContain('PE-1');
    // The id is still used for routing — see the /orders/:id test below.
  });

  it('TC-C02/TC-D13 — two active orders: one bar + 2 indicator dots', async () => {
    trackedOrders.set([makeOrder('1'), makeOrder('2')]);
    const fixture = await createFixture();

    expect(fixture.nativeElement.querySelectorAll('.live-orders-tracker__bar').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.live-orders-tracker__dot').length).toBe(2);
  });

  it('TC-C03/TC-D13 — three active orders: one bar + 3 indicator dots', async () => {
    trackedOrders.set([makeOrder('1'), makeOrder('2'), makeOrder('3')]);
    const fixture = await createFixture();

    expect(fixture.nativeElement.querySelectorAll('.live-orders-tracker__bar').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.live-orders-tracker__dot').length).toBe(3);
  });

  it('TC-C05/TC-C06 — the newest order (index 0, already sorted createdAt desc by the store) is selected initially', async () => {
    trackedOrders.set([makeOrder('newest'), makeOrder('older'), makeOrder('oldest')]);
    const fixture = await createFixture();

    expect(bar(fixture).textContent).toContain('Restaurant newest');
  });

  it('TC-D02 — the current status is displayed via the existing OrderStatusBadgeComponent', async () => {
    trackedOrders.set([makeOrder('1', 'OUT_FOR_DELIVERY')]);
    const fixture = await createFixture();

    // "Out for delivery" is OrderStatusBadgeComponent's own established label — not duplicated here.
    expect(bar(fixture).textContent).toContain('Out for delivery');
  });

  it('TC-D04/TC-D05 — no ETA field exists on OrderResponseDto, so the status message is shown and no ETA text is ever fabricated', async () => {
    trackedOrders.set([makeOrder('1', 'PREPARING')]);
    const fixture = await createFixture();

    expect(bar(fixture).textContent).toContain('Your order is being prepared');
    expect(bar(fixture).textContent).not.toMatch(/arriving/i);
    expect(bar(fixture).textContent).not.toMatch(/\bETA\b/i);
  });

  it('TC-D03 — every active status maps to its own non-empty, non-fabricated status message', async () => {
    const statuses: OrderResponseDto['status'][] = [
      'PENDING',
      'CONFIRMED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'OUT_FOR_DELIVERY',
    ];

    for (const status of statuses) {
      trackedOrders.set([makeOrder('1', status)]);
      const fixture = await createFixture();
      const message = fixture.nativeElement.querySelector('.live-orders-tracker__message');
      expect(message?.textContent?.trim()).toBeTruthy();
    }
  });

  it('TC-C07/TC-D07 — a status change on the selected order updates the badge and message without changing the selection', async () => {
    const b = makeOrder('B', 'PENDING');
    trackedOrders.set([makeOrder('A'), b, makeOrder('C')]);
    const fixture = await createFixture();

    instance(fixture).select('B');
    await settle(fixture);
    expect(bar(fixture).textContent).toContain('Restaurant B');
    expect(bar(fixture).textContent).toContain('Waiting for restaurant confirmation');

    // In-place status patch — same array of ids, just B's status field changed (exactly what
    // LiveOrdersStore.applyStatusChange does for a realtime order.status.changed event).
    trackedOrders.set([makeOrder('A'), { ...b, status: 'CONFIRMED' }, makeOrder('C')]);
    await settle(fixture);

    expect(bar(fixture).textContent).toContain('Restaurant B');
    expect(bar(fixture).textContent).toContain('Restaurant accepted your order');
  });

  it('TC-C08 — swipe left moves to the next (older) order', async () => {
    trackedOrders.set([makeOrder('A'), makeOrder('B'), makeOrder('C')]);
    const fixture = await createFixture();

    instance(fixture).onSwiped({ direction: 'left', distancePx: 60, velocityPxPerMs: 0.5 });
    await settle(fixture);

    expect(bar(fixture).textContent).toContain('Restaurant B');
  });

  it('TC-C09 — swipe right moves to the previous (newer) order', async () => {
    trackedOrders.set([makeOrder('A'), makeOrder('B'), makeOrder('C')]);
    const fixture = await createFixture();

    instance(fixture).select('C');
    await settle(fixture);

    instance(fixture).onSwiped({ direction: 'right', distancePx: 60, velocityPxPerMs: 0.5 });
    await settle(fixture);

    expect(bar(fixture).textContent).toContain('Restaurant B');
  });

  it('does not swipe past the first or last order', async () => {
    trackedOrders.set([makeOrder('A'), makeOrder('B')]);
    const fixture = await createFixture();

    instance(fixture).onSwiped({ direction: 'right', distancePx: 60, velocityPxPerMs: 0.5 });
    await settle(fixture);
    expect(bar(fixture).textContent).toContain('Restaurant A');

    instance(fixture).select('B');
    await settle(fixture);
    instance(fixture).onSwiped({ direction: 'left', distancePx: 60, velocityPxPerMs: 0.5 });
    await settle(fixture);
    expect(bar(fixture).textContent).toContain('Restaurant B');
  });

  it('TC-C10/TC-D08 — the bar links to /orders/:id for the selected order, and its content switches with it', async () => {
    trackedOrders.set([makeOrder('A', 'PENDING'), makeOrder('B', 'OUT_FOR_DELIVERY')]);
    const fixture = await createFixture();

    expect(bar(fixture).getAttribute('href')).toBe('/orders/A');
    expect(bar(fixture).textContent).toContain('Restaurant A');
    expect(bar(fixture).textContent).toContain('Waiting for restaurant confirmation');

    instance(fixture).select('B');
    await settle(fixture);

    expect(bar(fixture).getAttribute('href')).toBe('/orders/B');
    expect(bar(fixture).textContent).toContain('Restaurant B');
    expect(bar(fixture).textContent).toContain('Out for delivery');
  });

  it('TC-C11/TC-D09 — the selected order becoming DELIVERED (dropped by the store) selects the next valid order', async () => {
    trackedOrders.set([makeOrder('A'), makeOrder('B'), makeOrder('C')]);
    const fixture = await createFixture();

    instance(fixture).select('B');
    await settle(fixture);

    // LiveOrdersStore removes a terminal order from trackedOrders entirely — simulated here by
    // the mock facade emitting the array without B.
    trackedOrders.set([makeOrder('A'), makeOrder('C')]);
    await settle(fixture);

    // B sat at index 1; "previous position" (index 0) is A — see the component's own doc comment.
    expect(bar(fixture).textContent).toContain('Restaurant A');
  });

  it('TC-C12/TC-D09 — the selected order becoming CANCELLED behaves the same as DELIVERED', async () => {
    trackedOrders.set([makeOrder('A')]);
    const fixture = await createFixture();

    trackedOrders.set([]);
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('.live-orders-tracker')).toBeNull();
  });

  it('TC-C11b — removing the first (selected) order falls forward to the new first order', async () => {
    trackedOrders.set([makeOrder('A'), makeOrder('B'), makeOrder('C')]);
    const fixture = await createFixture();
    // A is selected by default (newest) — no explicit select() needed.

    trackedOrders.set([makeOrder('B'), makeOrder('C')]);
    await settle(fixture);

    expect(bar(fixture).textContent).toContain('Restaurant B');
  });

  it('TC-C13 — a non-selected order becoming terminal leaves the selection stable', async () => {
    trackedOrders.set([makeOrder('A'), makeOrder('B'), makeOrder('C')]);
    const fixture = await createFixture();

    instance(fixture).select('B');
    await settle(fixture);

    // A (not selected) drops out.
    trackedOrders.set([makeOrder('B'), makeOrder('C')]);
    await settle(fixture);

    expect(bar(fixture).textContent).toContain('Restaurant B');
  });

  it('TC-C14 — a newly-placed order (arrives at the front) becomes the selected order', async () => {
    trackedOrders.set([makeOrder('A'), makeOrder('B'), makeOrder('C')]);
    const fixture = await createFixture();

    instance(fixture).select('C');
    await settle(fixture);
    expect(bar(fixture).textContent).toContain('Restaurant C');

    // upsertOrder() pushes the just-placed order to the front — same createdAt-desc shape.
    trackedOrders.set([makeOrder('new'), makeOrder('A'), makeOrder('B')]);
    await settle(fixture);

    expect(bar(fixture).textContent).toContain('Restaurant new');
  });

  it('a tail promotion (4th order filling the freed 3rd slot) does not disturb an unrelated selection', async () => {
    trackedOrders.set([makeOrder('A'), makeOrder('B'), makeOrder('C')]);
    const fixture = await createFixture();

    instance(fixture).select('A');
    await settle(fixture);

    // C (oldest of the 3, not selected) drops out; D (previously outside the top 3) is promoted
    // in by the store — the front of the array (A) is unchanged, so this must NOT be treated as a
    // "new order arrived" jump.
    trackedOrders.set([makeOrder('A'), makeOrder('B'), makeOrder('D')]);
    await settle(fixture);

    expect(bar(fixture).textContent).toContain('Restaurant A');
  });

  it('TC-C21 — hides on the checkout route even with active orders', async () => {
    trackedOrders.set([makeOrder('1')]);
    const fixture = await createFixture();
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/checkout');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.live-orders-tracker')).toBeNull();
  });

  it('TC-C22 — hides on the orders list/detail routes', async () => {
    trackedOrders.set([makeOrder('1')]);
    const fixture = await createFixture();
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/orders/1');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.live-orders-tracker')).toBeNull();
  });

  it('TC-C20 — stacks above the cart checkout bar when the cart also has items', async () => {
    trackedOrders.set([makeOrder('1')]);
    totalItems.set(2);
    const fixture = await createFixture();

    const tracker = fixture.nativeElement.querySelector('.live-orders-tracker');
    expect(tracker.classList.contains('live-orders-tracker--above-cart-bar')).toBe(true);
  });

  it('TC-C23 — dots are keyboard/screen-reader accessible tabs, and the active one is marked selected', async () => {
    trackedOrders.set([makeOrder('A'), makeOrder('B'), makeOrder('C')]);
    const fixture = await createFixture();

    const dots: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.live-orders-tracker__dot'),
    );
    expect(dots).toHaveLength(3);
    expect(dots.every((dot) => dot.getAttribute('role') === 'tab')).toBe(true);
    expect(dots[0].getAttribute('aria-selected')).toBe('true');
    expect(dots[1].getAttribute('aria-selected')).toBe('false');
    // The dot's own label now carries the restaurant name, not the order number.
    expect(dots[0].getAttribute('aria-label')).toContain('Restaurant A');

    dots[2].click();
    await settle(fixture);
    expect(bar(fixture).textContent).toContain('Restaurant C');
  });

  it('TC-C23b — arrow-key navigation on the bar moves the selection (keyboard equivalent of swipe)', async () => {
    trackedOrders.set([makeOrder('A'), makeOrder('B'), makeOrder('C')]);
    const fixture = await createFixture();

    instance(fixture).selectNext();
    await settle(fixture);
    expect(bar(fixture).textContent).toContain('Restaurant B');

    instance(fixture).selectPrevious();
    await settle(fixture);
    expect(bar(fixture).textContent).toContain('Restaurant A');
  });

  it('a single active order still shows one decorative, non-interactive dot', async () => {
    trackedOrders.set([makeOrder('1')]);
    const fixture = await createFixture();

    expect(fixture.nativeElement.querySelectorAll('.live-orders-tracker__dot').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.live-orders-tracker__dot[role="tab"]')).toBeNull();
  });

  it("a swipe suppresses the click that follows it, so it doesn't also navigate", async () => {
    trackedOrders.set([makeOrder('A'), makeOrder('B')]);
    const fixture = await createFixture();
    const comp = instance(fixture);

    comp.onSwiped({ direction: 'left', distancePx: 60, velocityPxPerMs: 0.5 });
    const clickEvent = { preventDefault: jest.fn() } as unknown as MouseEvent;
    (comp as unknown as { onBarClick(event: MouseEvent): void }).onBarClick(clickEvent);

    expect(clickEvent.preventDefault).toHaveBeenCalled();
  });

  it('TC-D05 — never invents a restaurant name: a just-placed order with no restaurantName yet shows a neutral label, not a guess', async () => {
    trackedOrders.set([{ id: '1', orderNumber: 'PE-1', status: 'PENDING', restaurantName: undefined } as OrderResponseDto]);
    const fixture = await createFixture();

    expect(bar(fixture).textContent).toContain('Your order');
    expect(bar(fixture).textContent).not.toContain('undefined');
  });

  it('TC-D06 — a long restaurant name does not push the status badge or chevron out of the bar', async () => {
    const longName = 'The Very Long Restaurant Name That Keeps Going And Going And Going';
    trackedOrders.set([makeOrder('1', 'PREPARING', longName)]);
    const fixture = await createFixture();

    expect(bar(fixture).textContent).toContain(longName);
    expect(fixture.nativeElement.querySelector('lib-order-status-badge')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.live-orders-tracker__chevron')).not.toBeNull();
    const restaurantEl = fixture.nativeElement.querySelector('.live-orders-tracker__restaurant');
    // The truncation contract lives in CSS (overflow/text-overflow/white-space — see the
    // stylesheet); this asserts the class that carries it is actually applied.
    expect(restaurantEl).not.toBeNull();
  });

  it('TC-D10 — the bar has an accessible name containing the restaurant, status, and status message', async () => {
    trackedOrders.set([makeOrder('1', 'OUT_FOR_DELIVERY', 'Paradise Biryani')]);
    const fixture = await createFixture();

    const accessibleName = bar(fixture).textContent?.replace(/\s+/g, ' ').trim();
    expect(accessibleName).toContain('Paradise Biryani');
    expect(accessibleName).toContain('Out for delivery');
    expect(accessibleName).toContain('Your order is on the way');
  });
});
