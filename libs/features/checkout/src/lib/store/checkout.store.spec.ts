import { TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CartFacade } from '@patheya-express-frontend/cart';
import { AddressesFacade } from '@patheya-express-frontend/addresses';
import { PaymentsCheckoutService } from '@patheya-express-frontend/core';
import { CustomerWalletFacade } from '@patheya-express-frontend/customer-wallet';
import { CouponFacade } from '@patheya-express-frontend/coupons';
import {
  CouponsService as CouponsApiService,
  type CouponResponseDto,
  type CouponValidationResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { CheckoutStore } from './checkout.store';
import { CheckoutService } from '../services/checkout.service';

/**
 * Regression coverage for the checkout/coupon effect-loop bug found in the customer-app
 * architecture audit.
 *
 * Root cause: CheckoutStore's constructor effect reacts to `couponFacade.appliedCoupon()`, and
 * calls `couponFacade.refresh()` whenever a coupon is applied. `CouponStore.apply()` (which
 * `refresh()` calls internally) used to write a *new* coupon object to that signal on every
 * successful validate() — never reference-equal to the previous one — so the effect's own
 * refresh() call always looked like a "change", re-triggering the effect, forever. Fixed by giving
 * `_appliedCoupon` (coupon.store.ts) an equal-by-id comparator: a refresh() that confirms the same
 * coupon is still applied no longer notifies subscribers. `_pricing` is intentionally left with
 * default equality, so the displayed discount/total still update on every refresh.
 *
 * Only the actual network boundary (the generated SDK's CouponsService) is faked below —
 * CouponFacade, CouponStore, and the feature-level coupons wrapper all run as real, unmodified
 * production code, so these tests exercise Angular's real effect scheduler against the real
 * reactive graph, not a simulation of it.
 *
 * Not covered here (inherently outside a store-level unit test, both singletons are root-scoped):
 * - "Browser refresh" reinitializes the whole JS context; neither store persists across a real
 *   reload (no localStorage/sessionStorage involved), so a fresh singleton construction — the
 *   "apply once" test below — is the equivalent starting state.
 * - "Navigate away and back" doesn't destroy either store (both are `providedIn: 'root'`), so
 *   there's no separate teardown/re-init path to exercise; the "idle ticks after settling" and
 *   "cart change" tests below cover its only observable effect (the store keeps reacting to real
 *   signal changes correctly, without leaking a loop from an earlier interaction).
 */

// Fixed reference instants — not `new Date()` per call — so every field of the *coupon* half of
// the response is deterministic and identical across repeated validate() calls for the same code,
// exactly like the real backend returns for an unchanged coupon row. Only `totalUsed` is varied
// per call (see buildCouponResponse), simulating the one field that's genuinely expected to drift
// between calls and that CouponStore's equality comparator deliberately ignores (see
// coupon.store.ts's isSameAppliedCoupon doc comment).
const FIXED_CREATED_AT = new Date('2026-01-01T00:00:00.000Z').toISOString();
const FIXED_STARTS_AT = new Date('2026-01-01T00:00:00.000Z').toISOString();
const FIXED_ENDS_AT = new Date('2026-12-31T00:00:00.000Z').toISOString();

let totalUsedCounter = 0;

/**
 * A coupon's identity (id) is derived from its code, exactly like the real backend: the same code
 * always resolves to the same coupon row. Every call still returns a brand-new object (matching
 * real HTTP deserialization — never reference-equal to a previous response, even for the same
 * code), which is precisely the condition that used to make CheckoutStore's effect loop.
 */
function buildCouponResponse(code: string, discountAmount = 20): CouponValidationResponseDto {
  totalUsedCounter += 1;
  const coupon: CouponResponseDto = {
    id: `coupon-id-${code}`,
    code,
    name: `${code} promo`,
    description: undefined,
    active: true,
    scope: 'PLATFORM',
    type: 'FLAT',
    value: discountAmount,
    minOrderAmount: 0,
    maxDiscountAmount: undefined,
    usageLimit: undefined,
    usagePerUser: 1,
    restaurantId: undefined,
    startsAt: FIXED_STARTS_AT,
    endsAt: FIXED_ENDS_AT,
    createdAt: FIXED_CREATED_AT,
    // Deliberately volatile across calls, unlike every other field: real-world analogue of
    // concurrent redemption elsewhere. isSameAppliedCoupon() must ignore this.
    totalUsed: totalUsedCounter,
    updatedAt: new Date().toISOString(),
  };
  return {
    coupon,
    pricing: {
      subtotal: 200,
      deliveryFee: 40,
      taxAmount: 10,
      discountAmount,
      platformFee: 0,
      walletAmount: 0,
      totalAmount: 250 - discountAmount,
      pricingBreakdown: [],
    },
  };
}

function envelope<T>(data: T) {
  return { success: true, timestamp: new Date().toISOString(), data };
}

describe('CheckoutStore / CouponStore effect interaction', () => {
  let restaurantId: WritableSignal<string | null>;
  let subtotal: WritableSignal<number>;
  let validateSpy: jest.Mock;

  beforeEach(() => {
    totalUsedCounter = 0;
    restaurantId = signal<string | null>('restaurant-1');
    subtotal = signal(200);
    validateSpy = jest
      .fn()
      .mockImplementation(async (params: { body: { code: string } }) =>
        envelope(buildCouponResponse(params.body.code)),
      );

    TestBed.configureTestingModule({
      providers: [
        {
          provide: CartFacade,
          useValue: {
            items: signal([]),
            loading: signal(false),
            error: signal(null),
            subtotal,
            totalItems: signal(0),
            restaurantId,
            restaurantName: signal('Test Restaurant'),
            pendingConflict: signal(null),
            clear: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: AddressesFacade, useValue: { selectedAddressId: signal('address-1') } },
        { provide: CheckoutService, useValue: { placeOrder: jest.fn() } },
        { provide: PaymentsCheckoutService, useValue: { payForOrder: jest.fn() } },
        { provide: CustomerWalletFacade, useValue: { applyToOrder: jest.fn() } },
        { provide: CouponsApiService, useValue: { couponsControllerValidate: validateSpy } },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  async function settle(rounds = 8): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      TestBed.tick();
      await Promise.resolve();
      await Promise.resolve();
    }
  }

  it('applies a coupon once and does not keep re-validating with no further input changes', async () => {
    const couponFacade = TestBed.inject(CouponFacade);

    await couponFacade.apply('SAVE10', 'restaurant-1', 200);
    expect(validateSpy).toHaveBeenCalledTimes(1);

    // Instantiate CheckoutStore now — its constructor effect starts observing appliedCoupon().
    TestBed.inject(CheckoutStore);
    await settle(8);

    // Exactly one additional call: the effect's first run sees the already-applied coupon and
    // refreshes it once. That refresh confirms the same coupon (same id), which — post-fix —
    // does not notify the effect again.
    expect(validateSpy).toHaveBeenCalledTimes(2);

    // Prove it's actually bounded, not just "happened to stop within 8 rounds": many more rounds
    // with zero further input changes must not add any more calls.
    await settle(20);
    expect(validateSpy).toHaveBeenCalledTimes(2);
  });

  it('re-validates exactly once per real cart subtotal change while a coupon is applied', async () => {
    const couponFacade = TestBed.inject(CouponFacade);
    TestBed.inject(CheckoutStore);

    await couponFacade.apply('SAVE10', 'restaurant-1', 200);
    await settle(4);
    // 1 explicit apply() + 1 effect-triggered refresh() reacting to the coupon becoming applied.
    expect(validateSpy).toHaveBeenCalledTimes(2);

    // A legitimate cart change (e.g. quantity edit) — the effect exists specifically to keep the
    // discount accurate against this. Exactly one more call, not a cascade.
    subtotal.set(150);
    await settle(8);
    expect(validateSpy).toHaveBeenCalledTimes(3);

    // No further change — must not cascade from that single legitimate refresh either.
    await settle(8);
    expect(validateSpy).toHaveBeenCalledTimes(3);
  });

  it('stops re-validating once the coupon is removed', async () => {
    const couponFacade = TestBed.inject(CouponFacade);
    TestBed.inject(CheckoutStore);

    await couponFacade.apply('SAVE10', 'restaurant-1', 200);
    await settle(4);
    expect(validateSpy).toHaveBeenCalledTimes(2);
    expect(couponFacade.appliedCoupon()).not.toBeNull();

    couponFacade.remove();
    expect(couponFacade.appliedCoupon()).toBeNull();

    // Further cart changes must not resurrect validation once there's no applied coupon.
    subtotal.set(75);
    await settle(8);
    expect(validateSpy).toHaveBeenCalledTimes(2);
  });

  it('replacing the applied coupon with a different one settles without cascading', async () => {
    const couponFacade = TestBed.inject(CouponFacade);
    TestBed.inject(CheckoutStore);

    await couponFacade.apply('SAVE10', 'restaurant-1', 200);
    await settle(4);
    // 1 explicit apply() + 1 effect-triggered refresh() for the first applied coupon.
    expect(validateSpy).toHaveBeenCalledTimes(2);
    expect(couponFacade.appliedCoupon()?.id).toBe('coupon-id-SAVE10');

    await couponFacade.apply('WELCOME20', 'restaurant-1', 200); // explicit call: 3
    expect(couponFacade.appliedCoupon()?.id).toBe('coupon-id-WELCOME20');

    await settle(8);
    // The effect sees the applied coupon's id actually changed (coupon-1 -> coupon-2), so it
    // legitimately refreshes the new one once more (call 4) — then must go quiet.
    expect(validateSpy).toHaveBeenCalledTimes(4);
    const stableCount = validateSpy.mock.calls.length;
    await settle(8);
    expect(validateSpy).toHaveBeenCalledTimes(stableCount);
  });

  it('reapplying the same coupon code (e.g. a duplicate user click) does not cascade', async () => {
    const couponFacade = TestBed.inject(CouponFacade);
    TestBed.inject(CheckoutStore);

    await couponFacade.apply('SAVE10', 'restaurant-1', 200);
    await settle(4);
    const afterFirstApply = validateSpy.mock.calls.length;

    await couponFacade.apply('SAVE10', 'restaurant-1', 200);
    await settle(8);

    // The explicit re-apply call itself always hits the network (that's a direct user action, not
    // the effect looping) — but it must not multiply beyond that single extra call.
    expect(validateSpy.mock.calls.length).toBeLessThanOrEqual(afterFirstApply + 2);
    const stableCount = validateSpy.mock.calls.length;
    await settle(8);
    expect(validateSpy).toHaveBeenCalledTimes(stableCount);
  });

  it('an invalid/expired coupon clears applied state and does not loop retrying', async () => {
    const couponFacade = TestBed.inject(CouponFacade);
    TestBed.inject(CheckoutStore);

    validateSpy.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 400, error: { message: 'This coupon has expired.' } }),
    );

    const applied = await couponFacade.apply('EXPIRED5', 'restaurant-1', 200);

    expect(applied).toBe(false);
    expect(couponFacade.appliedCoupon()).toBeNull();
    expect(couponFacade.validationError()).toBe('This coupon has expired.');

    await settle(8);
    // No coupon applied, so CheckoutStore's effect condition (`coupon && restaurantId`) never
    // becomes true — no retry loop.
    expect(validateSpy).toHaveBeenCalledTimes(1);
  });

  it('a network failure during validate clears applied state without throwing or looping', async () => {
    const couponFacade = TestBed.inject(CouponFacade);
    TestBed.inject(CheckoutStore);

    validateSpy.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(couponFacade.apply('SAVE10', 'restaurant-1', 200)).resolves.toBe(false);
    expect(couponFacade.appliedCoupon()).toBeNull();

    await settle(8);
    expect(validateSpy).toHaveBeenCalledTimes(1);
  });

  it('end-to-end sequence (apply -> cart change -> remove) makes only the expected number of calls', async () => {
    const couponFacade = TestBed.inject(CouponFacade);
    TestBed.inject(CheckoutStore);

    await couponFacade.apply('SAVE10', 'restaurant-1', 200); // call 1
    await settle(4); // effect refresh: call 2
    subtotal.set(120); // legitimate cart change: call 3
    await settle(4);
    couponFacade.remove();
    await settle(8); // no more calls: coupon is null

    expect(validateSpy).toHaveBeenCalledTimes(3);
  });

  it('exposes an unstale coupon object even though totalUsed increments on every refresh', async () => {
    const couponFacade = TestBed.inject(CouponFacade);
    TestBed.inject(CheckoutStore);

    await couponFacade.apply('SAVE10', 'restaurant-1', 200);
    await settle(4);
    // Confirms isSameAppliedCoupon() is deliberately ignoring totalUsed (which the fixture
    // increments on every call, simulating concurrent redemption elsewhere) rather than the loop
    // simply not having had a chance to run.
    expect(validateSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(couponFacade.appliedCoupon()?.code).toBe('SAVE10');

    await settle(8);
    expect(validateSpy).toHaveBeenCalledTimes(2);
  });

  it('does react when a non-volatile field of the same coupon id actually changes', async () => {
    const couponFacade = TestBed.inject(CouponFacade);
    TestBed.inject(CheckoutStore);

    await couponFacade.apply('SAVE10', 'restaurant-1', 200);
    await settle(4);
    expect(validateSpy).toHaveBeenCalledTimes(2);
    expect(couponFacade.appliedCoupon()?.maxDiscountAmount).toBeUndefined();

    // Simulate the coupon's own terms permanently changing server-side (e.g. an admin caps the
    // max discount) — same id, but a field isSameAppliedCoupon() does compare. Overriding the
    // *default* implementation (not mockImplementationOnce) models this as durable, exactly like
    // a real backend would consistently return the same row for every subsequent call — a
    // one-shot override would make the mock itself oscillate back to the old value on the very
    // next effect-triggered refresh, which isn't what a real permanent change looks like.
    validateSpy.mockImplementation(async (params: { body: { code: string } }) => {
      const response = buildCouponResponse(params.body.code);
      response.coupon.maxDiscountAmount = 50;
      return envelope(response);
    });

    subtotal.set(150); // triggers the effect's next refresh()
    await settle(8);

    // The signal must have propagated the new maxDiscountAmount — proving the comparator isn't so
    // broad that it also swallows genuine, meaningful changes to the same coupon id.
    expect(couponFacade.appliedCoupon()?.maxDiscountAmount).toBe(50);
  });
});

/**
 * Enterprise order idempotency (Sprint 1.2). CheckoutStore.placeOrder() generates one UUID per
 * checkout attempt and sends it as CreateOrderDto.idempotencyKey — reused verbatim on any retry
 * of the SAME attempt (failure, resubmit) and replaced with a fresh one only after a success.
 * A synchronous re-entrancy guard also stops a genuine double-click from ever reaching the
 * network twice, independent of the idempotency key mechanism. Only the network boundary
 * (CheckoutService) is mocked — CheckoutStore itself runs as real, unmodified production code.
 */
describe('CheckoutStore.placeOrder — idempotency (Sprint 1.2)', () => {
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  let placeOrderSpy: jest.Mock;
  let payForOrderSpy: jest.Mock;
  let cartClearSpy: jest.Mock;

  function buildCartItem() {
    return {
      id: 'cart-item-1',
      menuItemId: 'menu-item-1',
      variantId: undefined,
      quantity: 1,
      addonOptions: [],
      specialInstructions: undefined,
      isAvailable: true,
    };
  }

  function buildOrderResponse(overrides: Partial<{ id: string; orderNumber: string; totalAmount: string }> = {}) {
    return {
      id: 'order-1',
      orderNumber: 'ORD-1',
      totalAmount: '199.00',
      ...overrides,
    };
  }

  beforeEach(() => {
    placeOrderSpy = jest.fn();
    payForOrderSpy = jest.fn().mockResolvedValue(true);
    cartClearSpy = jest.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: CartFacade,
          useValue: {
            items: signal([buildCartItem()]),
            loading: signal(false),
            error: signal(null),
            subtotal: signal(199),
            totalItems: signal(1),
            restaurantId: signal('restaurant-1'),
            restaurantName: signal('Test Restaurant'),
            pendingConflict: signal(null),
            clear: cartClearSpy,
          },
        },
        { provide: AddressesFacade, useValue: { selectedAddressId: signal('address-1') } },
        { provide: CheckoutService, useValue: { placeOrder: placeOrderSpy } },
        { provide: PaymentsCheckoutService, useValue: { payForOrder: payForOrderSpy } },
        { provide: CustomerWalletFacade, useValue: { applyToOrder: jest.fn() } },
        { provide: CouponsApiService, useValue: { couponsControllerValidate: jest.fn() } },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('sends a v4-UUID idempotencyKey with the order', async () => {
    placeOrderSpy.mockResolvedValue(buildOrderResponse());
    const checkoutStore = TestBed.inject(CheckoutStore);

    await checkoutStore.placeOrder();

    expect(placeOrderSpy).toHaveBeenCalledTimes(1);
    const dto = placeOrderSpy.mock.calls[0][0];
    expect(dto.idempotencyKey).toEqual(expect.stringMatching(UUID_PATTERN));
  });

  it('reuses the same idempotency key when retrying after a failed attempt', async () => {
    placeOrderSpy.mockRejectedValueOnce(new Error('network timeout'));
    placeOrderSpy.mockResolvedValueOnce(buildOrderResponse());
    const checkoutStore = TestBed.inject(CheckoutStore);

    const first = await checkoutStore.placeOrder();
    expect(first).toBeNull();
    expect(checkoutStore.error()).toBe('Unable to place your order. Please try again.');

    const second = await checkoutStore.placeOrder();
    expect(second).not.toBeNull();

    expect(placeOrderSpy).toHaveBeenCalledTimes(2);
    const firstKey = placeOrderSpy.mock.calls[0][0].idempotencyKey;
    const secondKey = placeOrderSpy.mock.calls[1][0].idempotencyKey;
    expect(secondKey).toBe(firstKey);
  });

  it('generates a fresh idempotency key for the next order after a success', async () => {
    placeOrderSpy
      .mockResolvedValueOnce(buildOrderResponse({ id: 'order-1' }))
      .mockResolvedValueOnce(buildOrderResponse({ id: 'order-2' }));
    const checkoutStore = TestBed.inject(CheckoutStore);

    await checkoutStore.placeOrder();
    await checkoutStore.placeOrder();

    expect(placeOrderSpy).toHaveBeenCalledTimes(2);
    const firstKey = placeOrderSpy.mock.calls[0][0].idempotencyKey;
    const secondKey = placeOrderSpy.mock.calls[1][0].idempotencyKey;
    expect(secondKey).not.toBe(firstKey);
  });

  it('a synchronous double-click never reaches the network twice', async () => {
    let resolvePlaceOrder!: (value: unknown) => void;
    placeOrderSpy.mockReturnValue(
      new Promise((resolve) => {
        resolvePlaceOrder = resolve;
      }),
    );
    const checkoutStore = TestBed.inject(CheckoutStore);

    // Both calls fire synchronously, exactly like two rapid click handlers — no await between
    // them — so this exercises the guard at the very top of placeOrder(), not the button's
    // `[loading]` input binding (which has a change-detection-timing gap; see the guard's doc
    // comment in checkout.store.ts).
    const firstCall = checkoutStore.placeOrder();
    const secondCall = checkoutStore.placeOrder();

    await expect(secondCall).resolves.toBeNull();
    expect(placeOrderSpy).toHaveBeenCalledTimes(1);

    resolvePlaceOrder(buildOrderResponse());
    await expect(firstCall).resolves.toMatchObject({ id: 'order-1' });
  });

  it('allows a genuinely new placeOrder() call once the in-flight one has finished', async () => {
    placeOrderSpy
      .mockResolvedValueOnce(buildOrderResponse({ id: 'order-1' }))
      .mockResolvedValueOnce(buildOrderResponse({ id: 'order-2' }));
    const checkoutStore = TestBed.inject(CheckoutStore);

    await checkoutStore.placeOrder();
    const second = await checkoutStore.placeOrder();

    expect(second?.id).toBe('order-2');
    expect(placeOrderSpy).toHaveBeenCalledTimes(2);
  });
});
