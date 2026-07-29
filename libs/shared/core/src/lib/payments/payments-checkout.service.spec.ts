import { TestBed } from '@angular/core/testing';
import { PaymentsService } from '@patheya-express-frontend/api-sdk';
import { PaymentsCheckoutService } from './payments-checkout.service';
import { RazorpayCheckoutService } from './razorpay-checkout.service';

/**
 * Sprint 1.5 — order-details' "Complete Payment" retry button had no re-entrancy guard (unlike
 * CheckoutStore's own synchronous guard around placeOrder()), so a double-click could open two
 * Razorpay widgets and fire two concurrent `/payments/create` + `/payments/verify` round-trips
 * for the same order. Fixed with a single in-flight guard shared by every caller of
 * payForOrder() (see the service's own doc comment). This is a UX/efficiency fix layered on top
 * of the backend's authoritative atomic claim (PaymentsService.transitionPaymentStatus) — the
 * backend is what actually guarantees correctness; this just avoids the wasted duplicate work
 * and the confusing "two payment popups" experience.
 */
describe('PaymentsCheckoutService — concurrent payForOrder calls', () => {
  let createPaymentSpy: jest.Mock;
  let verifyPaymentSpy: jest.Mock;
  let razorpayOpenSpy: jest.Mock;
  let service: PaymentsCheckoutService;

  function envelope<T>(data: T) {
    return { success: true, timestamp: new Date().toISOString(), data };
  }

  function buildOrder(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'order-1',
      orderNumber: 'ORD-1',
      totalAmount: '500.00',
      ...overrides,
    } as any;
  }

  beforeEach(() => {
    createPaymentSpy = jest.fn().mockResolvedValue(
      envelope({
        payment: { id: 'payment-1' },
        providerOrder: { id: 'order_rzp_1', amount: 50000, currency: 'INR' },
      }),
    );
    razorpayOpenSpy = jest.fn().mockResolvedValue({
      razorpay_order_id: 'order_rzp_1',
      razorpay_payment_id: 'pay_rzp_1',
      razorpay_signature: 'sig',
    });
    verifyPaymentSpy = jest.fn().mockResolvedValue(envelope({ id: 'payment-1', status: 'SUCCESS' }));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            paymentsControllerCreatePayment: createPaymentSpy,
            paymentsControllerVerifyPayment: verifyPaymentSpy,
          },
        },
        { provide: RazorpayCheckoutService, useValue: { open: razorpayOpenSpy } },
      ],
    });

    service = TestBed.inject(PaymentsCheckoutService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('a second concurrent call while one is already in flight reuses it instead of starting a new payment attempt', async () => {
    const order = buildOrder();

    // Both calls fire synchronously, exactly like a double-click — no await between them.
    // payForOrder() itself is synchronous up to the point of stashing `this.inFlight`, so the
    // second call is guaranteed to see the first's in-flight promise already set regardless of
    // how long the underlying network calls take to resolve.
    const first = service.payForOrder(order);
    const second = service.payForOrder(order);

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toBe(true);
    expect(secondResult).toBe(true);
    expect(createPaymentSpy).toHaveBeenCalledTimes(1);
    expect(razorpayOpenSpy).toHaveBeenCalledTimes(1);
    expect(verifyPaymentSpy).toHaveBeenCalledTimes(1);
  });

  it('a call after the previous one has fully completed starts a genuinely new attempt', async () => {
    const order = buildOrder();

    const first = await service.payForOrder(order);
    expect(first).toBe(true);
    expect(createPaymentSpy).toHaveBeenCalledTimes(1);

    const second = await service.payForOrder(order);

    expect(second).toBe(true);
    expect(createPaymentSpy).toHaveBeenCalledTimes(2);
  });

  it('a failed attempt clears the in-flight guard so a retry is not stuck forever', async () => {
    createPaymentSpy.mockRejectedValueOnce(new Error('network error'));
    const order = buildOrder();

    const first = await service.payForOrder(order);
    expect(first).toBe(false);

    createPaymentSpy.mockResolvedValue(
      envelope({
        payment: { id: 'payment-1' },
        providerOrder: { id: 'order_rzp_1', amount: 50000, currency: 'INR' },
      }),
    );
    verifyPaymentSpy.mockResolvedValue(envelope({ id: 'payment-1', status: 'SUCCESS' }));

    const second = await service.payForOrder(order);
    expect(second).toBe(true);
  });
});
