import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { CouponFacade } from '@patheya-express-frontend/coupons';
import { MediaUrlService } from '@patheya-express-frontend/core';
import { OrderDetailsPageComponent } from './order-details-page.component';
import { OrderDetailsFacade } from '../../facades/order-details.facade';

/**
 * Regression coverage for two payment/order lifecycle rules:
 * - "Payment Eligibility": the payment-action buttons must only be offered while the order is in
 *   a status where paying still means something (excludes DELIVERED/CANCELLED).
 * - Rule 6 ("COD Complete Payment") / Rule 4 ("Continue with COD"): correct button set/labels per
 *   paymentMode, paymentStatus, and status combination.
 *
 * The backend is the actual enforcement point for all of this (see OrdersService/PaymentsService
 * specs) — this only verifies the UI offers the right affordances, never hides a real capability
 * or, worse, offers one the backend would reject outright.
 */
describe('OrderDetailsPageComponent — payment eligibility and Continue with COD', () => {
  function buildOrder(overrides: Partial<OrderResponseDto> = {}): OrderResponseDto {
    return {
      id: 'order-1',
      customerId: 'customer-1',
      restaurantId: 'restaurant-1',
      orderNumber: 'ORD-1',
      createdAt: new Date().toISOString(),
      deliveryAddress: '123 Test Street',
      deliveryFee: 40,
      discountAmount: 0,
      items: [],
      paymentMode: 'ONLINE',
      paymentStatus: 'PENDING',
      status: 'PENDING',
      statusHistory: [],
      subtotalAmount: 220,
      taxAmount: 11,
      totalAmount: 271,
      ...overrides,
    };
  }

  let orderSignal: ReturnType<typeof signal<OrderResponseDto | null>>;
  let continueWithCodMock: jest.Mock;
  let retryPaymentMock: jest.Mock;

  async function createComponent() {
    orderSignal = signal<OrderResponseDto | null>(null);
    continueWithCodMock = jest.fn().mockResolvedValue(true);
    retryPaymentMock = jest.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [OrderDetailsPageComponent],
      providers: [
        {
          provide: OrderDetailsFacade,
          useValue: {
            order: orderSignal,
            restaurantName: signal('Test Restaurant'),
            loading: signal(false),
            error: signal<string | null>(null),
            location: signal(null),
            realtimeConnected: signal(true),
            pickupPhoto: signal(null),
            arrivedAtRestaurantAt: signal(null),
            initialize: jest.fn(),
            dispose: jest.fn(),
            retry: jest.fn(),
            retryPayment: retryPaymentMock,
            continueWithCod: continueWithCodMock,
          },
        },
        { provide: CouponFacade, useValue: { getCodeForOrder: jest.fn() } },
        { provide: MediaUrlService, useValue: { resolve: () => undefined } },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ orderId: 'order-1' })) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrderDetailsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  function queryText(fixture: { nativeElement: HTMLElement }, selector: string): string | null {
    return fixture.nativeElement.querySelector(selector)?.textContent?.trim() ?? null;
  }

  it('shows "Retry Payment" and "Continue with COD" for a PENDING, unpaid ONLINE order', async () => {
    const fixture = await createComponent();
    orderSignal.set(buildOrder({ paymentMode: 'ONLINE', paymentStatus: 'PENDING', status: 'PENDING' }));
    fixture.detectChanges();

    expect(queryText(fixture, '.retry-payment-btn')).toBe('Retry Payment');
    expect(fixture.nativeElement.querySelector('.switch-to-cod-btn')).not.toBeNull();
  });

  it('shows "Complete Payment" (not "Retry Payment") and no "Continue with COD" for a COD order still in progress', async () => {
    const fixture = await createComponent();
    orderSignal.set(buildOrder({ paymentMode: 'COD', paymentStatus: 'PENDING', status: 'OUT_FOR_DELIVERY' }));
    fixture.detectChanges();

    expect(queryText(fixture, '.retry-payment-btn')).toBe('Complete Payment');
    expect(fixture.nativeElement.querySelector('.switch-to-cod-btn')).toBeNull();
  });

  it('hides "Continue with COD" for an ONLINE order that has already been accepted (no longer PENDING)', async () => {
    const fixture = await createComponent();
    orderSignal.set(buildOrder({ paymentMode: 'ONLINE', paymentStatus: 'PENDING', status: 'CONFIRMED' }));
    fixture.detectChanges();

    // Still payable (CONFIRMED is a payable status), so Retry Payment remains — but switching to
    // COD is no longer legal per the backend (only allowed while still PENDING), so it must not
    // be offered.
    expect(fixture.nativeElement.querySelector('.retry-payment-btn')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.switch-to-cod-btn')).toBeNull();
  });

  it('hides all payment actions once the order is DELIVERED', async () => {
    const fixture = await createComponent();
    orderSignal.set(buildOrder({ paymentMode: 'ONLINE', paymentStatus: 'PENDING', status: 'DELIVERED' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.retry-payment-btn')).toBeNull();
    expect(fixture.nativeElement.querySelector('.switch-to-cod-btn')).toBeNull();
  });

  it('hides all payment actions once the order is CANCELLED', async () => {
    const fixture = await createComponent();
    orderSignal.set(buildOrder({ paymentMode: 'ONLINE', paymentStatus: 'PENDING', status: 'CANCELLED' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.retry-payment-btn')).toBeNull();
    expect(fixture.nativeElement.querySelector('.switch-to-cod-btn')).toBeNull();
  });

  it('hides all payment actions once the order is PAID, regardless of mode', async () => {
    const fixture = await createComponent();
    orderSignal.set(buildOrder({ paymentMode: 'ONLINE', paymentStatus: 'PAID', status: 'CONFIRMED' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.retry-payment-btn')).toBeNull();
    expect(fixture.nativeElement.querySelector('.switch-to-cod-btn')).toBeNull();
  });

  it('tapping "Continue with COD" calls the facade with this order id', async () => {
    const fixture = await createComponent();
    orderSignal.set(buildOrder({ paymentMode: 'ONLINE', paymentStatus: 'PENDING', status: 'PENDING' }));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.switch-to-cod-btn') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(continueWithCodMock).toHaveBeenCalledWith('order-1');
  });
});
