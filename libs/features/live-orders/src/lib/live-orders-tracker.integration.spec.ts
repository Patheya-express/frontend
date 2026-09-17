import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { CartFacade } from '@patheya-express-frontend/cart';
import { MobilePlatformService, RealtimeSocketService } from '@patheya-express-frontend/core';
import { LiveOrdersFloatingTrackerComponent } from './components/live-orders-floating-tracker/live-orders-floating-tracker.component';
import { LiveOrdersFacade } from './facades/live-orders.facade';
import { ActiveOrdersService } from './services/active-orders.service';

/**
 * End-to-end regression coverage (within the frontend) for the "tracker shows 'Your order'
 * instead of the real restaurant name right after checkout" defect. Exercises the REAL
 * LiveOrdersFacade → LiveOrdersStore → LiveOrdersFloatingTrackerComponent chain — only the true
 * I/O boundaries (ActiveOrdersService's GET /orders/me call and RealtimeSocketService's socket)
 * are mocked — proving that once the backend's POST /orders response carries `restaurantName`
 * (see orders.service.ts's toPlacedOrderResponse, apps/api-gateway), a single
 * `liveOrdersFacade.upsertOrder(order)` call — exactly what PlaceOrderSectionComponent does on a
 * successful checkout — is enough for the tracker to render the real name immediately, with no
 * GET /orders/me round-trip in between.
 */
describe('Live Orders tracker — restaurant name from a freshly placed order', () => {
  async function settle(fixture: { detectChanges(): void; whenStable(): Promise<void> }, rounds = 4): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      TestBed.tick();
      fixture.detectChanges();
      await Promise.resolve();
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders the restaurant name from the POST /orders response the moment it is upserted — no GET /orders/me needed', async () => {
    const getRecentOrdersMock = jest.fn().mockResolvedValue({ items: [], limit: 20, page: 1, total: 0, totalPages: 1 });

    await TestBed.configureTestingModule({
      imports: [LiveOrdersFloatingTrackerComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveOrdersService, useValue: { getRecentOrders: getRecentOrdersMock } },
        { provide: RealtimeSocketService, useValue: { joinRoom: jest.fn().mockResolvedValue(true), on: jest.fn() } },
        { provide: MobilePlatformService, useValue: { onResume: jest.fn(), isNative: () => false } },
        { provide: LogoutCleanupRegistry, useValue: { register: jest.fn() } },
        { provide: CartFacade, useValue: { totalItems: () => 0 } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LiveOrdersFloatingTrackerComponent);
    await settle(fixture);

    // Mirrors app.ts: LiveOrdersFacade.initialize() is called once, when authenticated — the
    // component itself never triggers it.
    TestBed.inject(LiveOrdersFacade).initialize();
    await settle(fixture);

    // Tracker starts empty — no active orders loaded yet (GET /orders/me returned none).
    expect(fixture.nativeElement.querySelector('.live-orders-tracker')).toBeNull();
    expect(getRecentOrdersMock).toHaveBeenCalledTimes(1);

    // Exactly what PlaceOrderSectionComponent does on a successful COD/ONLINE checkout: pass the
    // POST /orders response straight to upsertOrder(), whose `restaurantName` is now populated
    // server-side (see the backend fix this test guards).
    const placedOrder: OrderResponseDto = {
      id: 'order-just-placed',
      orderNumber: 'ORD-20260915-E04170',
      status: 'PENDING',
      restaurantName: 'Paradise Biryani',
      createdAt: new Date().toISOString(),
    } as OrderResponseDto;

    TestBed.inject(LiveOrdersFacade).upsertOrder(placedOrder);
    await settle(fixture);

    const bar = fixture.nativeElement.querySelector('.live-orders-tracker__bar');
    expect(bar).not.toBeNull();
    expect(bar.textContent).toContain('Paradise Biryani');
    expect(bar.textContent).not.toContain('Your order');
    expect(bar.getAttribute('href')).toBe('/orders/order-just-placed');

    // The restaurant name rendered above came straight from the upserted order — no fetch was
    // needed for *that*. A second GET /orders/me does fire once the upserted order's realtime
    // room join settles (floating-tracker resync fix, 2026-09-16): a status-changed event for
    // this exact order can otherwise arrive and be silently dropped by Socket.IO in the window
    // between placing the order and finishing that room join (e.g. a restaurant accepting within
    // seconds) — see LiveOrdersStore's room-join effect for the full explanation.
    expect(getRecentOrdersMock).toHaveBeenCalledTimes(2);
  });
});
