import { TestBed } from '@angular/core/testing';
import { CartService as CartApiService, type CartResponseDto } from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { CartStore } from './cart.store';

/**
 * Sprint 1.4 — proves the self-registration pattern (CartStore registers its own reset() into
 * LogoutCleanupRegistry, see cart.store.ts's constructor) actually closes the "logout clears
 * cart" / "no previous customer's data visible after logging in as someone else" requirements,
 * not just that reset() clears signals in isolation. Only the generated SDK's CartService is
 * faked — CartStore and LogoutCleanupRegistry both run as real, unmodified production code.
 */
describe('CartStore — logout cleanup', () => {
  let getCartSpy: jest.Mock;
  let store: CartStore;
  let registry: LogoutCleanupRegistry;

  function envelope<T>(data: T) {
    return { success: true, timestamp: new Date().toISOString(), data };
  }

  function buildCart(overrides: Partial<CartResponseDto> = {}): CartResponseDto {
    return {
      id: 'cart-1',
      restaurantId: 'restaurant-1',
      restaurantName: 'Test Restaurant',
      items: [],
      subtotal: 0,
      totalItems: 0,
      ...overrides,
    } as CartResponseDto;
  }

  beforeEach(() => {
    getCartSpy = jest.fn();

    TestBed.configureTestingModule({
      providers: [{ provide: CartApiService, useValue: { cartControllerGetCart: getCartSpy } }],
    });

    store = TestBed.inject(CartStore);
    registry = TestBed.inject(LogoutCleanupRegistry);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('constructing the store registers its reset() into the shared logout registry', async () => {
    getCartSpy.mockResolvedValue(
      envelope(buildCart({ restaurantId: 'restaurant-a', totalItems: 3, subtotal: 450 })),
    );
    await store.restore();
    expect(store.totalItems()).toBe(3);

    // Simulating AuthStore.logout()'s teardown step — CartStore never sees AuthStore directly.
    registry.runAll();

    expect(store.items()).toEqual([]);
    expect(store.totalItems()).toBe(0);
    expect(store.restaurantId()).toBeUndefined();
  });

  it('a different customer logging in on the same tab after logout never sees the previous cart', async () => {
    // Customer A's session.
    getCartSpy.mockResolvedValue(
      envelope(buildCart({ restaurantId: 'restaurant-a', totalItems: 2, subtotal: 300 })),
    );
    await store.restore();
    expect(store.subtotal()).toBe(300);

    // Logout.
    registry.runAll();
    expect(store.subtotal()).toBe(0);

    // Customer B logs in and their own cart restore runs, exactly like app.ts's constructor
    // effect does on every isAuthenticated() transition to true.
    getCartSpy.mockResolvedValue(
      envelope(buildCart({ restaurantId: 'restaurant-b', totalItems: 1, subtotal: 99 })),
    );
    await store.restore();

    expect(store.subtotal()).toBe(99);
    expect(store.restaurantId()).toBe('restaurant-b');
  });

  it('reset() also clears loading/error/pendingConflict state, not just the cart itself', async () => {
    getCartSpy.mockRejectedValue(new Error('network error'));
    await store.restore();
    expect(store.error()).not.toBeNull();

    registry.runAll();

    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(false);
    expect(store.pendingConflict()).toBeNull();
  });
});
