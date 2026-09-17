import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { ToastService } from '@patheya-express-frontend/ui';
import { HapticsService } from '@patheya-express-frontend/core';
import { LiveOrdersFacade } from '@patheya-express-frontend/live-orders';
import { PlaceOrderSectionComponent } from './place-order-section.component';
import { CheckoutFacade } from '../../facades/checkout.facade';

/**
 * Regression coverage for the P0 "order placed without payment" bug: CheckoutStore.placeOrder()
 * returns the created order even when its online-payment leg failed/was never completed (the
 * order is real and retryable from its details page — see CheckoutStore's doc comment), signalling
 * that failure only via the `error` signal, not via the return value. This component must not
 * treat a truthy order as a successful placement unless `error()` is also empty — otherwise a
 * failed/cancelled/never-opened Razorpay payment renders as "Order placed ✓" with no payment ever
 * shown to the customer.
 */
describe('PlaceOrderSectionComponent', () => {
  const order = { id: 'order-1' } as OrderResponseDto;

  let placeOrderMock: jest.Mock<Promise<OrderResponseDto | null>, []>;
  let errorSignal: ReturnType<typeof signal<string | null>>;
  let navigateByUrlMock: jest.Mock<Promise<boolean>, [string]>;
  let showToastMock: jest.Mock;
  let successHapticMock: jest.Mock;
  let errorHapticMock: jest.Mock;
  let upsertOrderMock: jest.Mock;

  beforeEach(async () => {
    placeOrderMock = jest.fn();
    errorSignal = signal<string | null>(null);
    navigateByUrlMock = jest.fn().mockResolvedValue(true);
    showToastMock = jest.fn();
    successHapticMock = jest.fn().mockResolvedValue(undefined);
    errorHapticMock = jest.fn().mockResolvedValue(undefined);
    upsertOrderMock = jest.fn();

    await TestBed.configureTestingModule({
      imports: [PlaceOrderSectionComponent],
      providers: [
        {
          provide: CheckoutFacade,
          useValue: {
            placeOrder: placeOrderMock,
            error: errorSignal,
            placingOrder: signal(false),
            validationErrors: signal<string[]>([]),
          },
        },
        { provide: Router, useValue: { navigateByUrl: navigateByUrlMock } },
        { provide: ToastService, useValue: { showToast: showToastMock } },
        { provide: HapticsService, useValue: { success: successHapticMock, error: errorHapticMock } },
        { provide: LiveOrdersFacade, useValue: { upsertOrder: upsertOrderMock } },
      ],
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(PlaceOrderSectionComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows success, records the order as a live order, and navigates Home when payment actually completed', async () => {
    placeOrderMock.mockResolvedValue(order);
    const fixture = createComponent();

    await (fixture.componentInstance as unknown as { placeOrder(): Promise<void> }).placeOrder();

    expect(successHapticMock).toHaveBeenCalledTimes(1);
    expect(errorHapticMock).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith({ message: 'Order placed ✓', tone: 'success' });
    // Pushed into the shared live-orders state directly (not left to a refetch after navigating)
    // so the floating tracker on Home shows it immediately, with no race.
    expect(upsertOrderMock).toHaveBeenCalledWith(order);
    expect(navigateByUrlMock).toHaveBeenCalledWith('/');
  });

  it('does NOT show success when the order exists but payment did not complete', async () => {
    placeOrderMock.mockImplementation(async () => {
      errorSignal.set('Payment was not completed. You can retry it from your order details.');
      return order;
    });
    const fixture = createComponent();

    await (fixture.componentInstance as unknown as { placeOrder(): Promise<void> }).placeOrder();

    expect(successHapticMock).not.toHaveBeenCalled();
    expect(errorHapticMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith({
      message: 'Payment was not completed. You can retry it from your order details.',
      tone: 'error',
    });
    // Still navigates to the real, existing (unpaid) order so the customer can retry payment
    // there — the bug was the false "Order placed ✓" signal, not the destination. Not a
    // successful placement, so it must not surface in the live-orders tracker either.
    expect(navigateByUrlMock).toHaveBeenCalledWith('/orders/order-1');
    expect(upsertOrderMock).not.toHaveBeenCalled();
  });

  it('does not navigate or show any toast when order creation itself failed', async () => {
    placeOrderMock.mockResolvedValue(null);
    const fixture = createComponent();

    await (fixture.componentInstance as unknown as { placeOrder(): Promise<void> }).placeOrder();

    expect(successHapticMock).not.toHaveBeenCalled();
    expect(errorHapticMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).not.toHaveBeenCalled();
    expect(navigateByUrlMock).not.toHaveBeenCalled();
    expect(upsertOrderMock).not.toHaveBeenCalled();
  });
});
