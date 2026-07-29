import { Injectable, inject } from '@angular/core';
import { PaymentsService, type OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { RazorpayCheckoutService } from './razorpay-checkout.service';

// The API gateway wraps every response in a { success, timestamp, data } envelope via a
// global interceptor that Swagger/the generated SDK types do not account for.
interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

/**
 * Drives the Razorpay payment flow for an already-placed order: creates a provider order,
 * opens the checkout widget, then verifies the signature server-side. Shared between the
 * initial checkout flow and order-details' payment retry — both are "pay for this order",
 * just triggered from different pages.
 */
@Injectable({ providedIn: 'root' })
export class PaymentsCheckoutService {
  private readonly paymentsService = inject(PaymentsService);
  private readonly razorpayCheckout = inject(RazorpayCheckoutService);

  // Sprint 1.5 — a user can only ever be paying for one order at a time in one browser tab, so a
  // single in-flight guard shared across every caller closes a real gap: unlike CheckoutStore
  // (which has its own synchronous re-entrancy guard around placeOrder()), order-details'
  // "Complete Payment" retry button had no equivalent guard, so a double-click could open two
  // Razorpay widgets and fire two `/payments/create` + `/payments/verify` round-trips
  // concurrently. The backend's atomic status-transition claim (PaymentsService.
  // transitionPaymentStatus) already makes that safe from a correctness standpoint, but this
  // still avoids the wasted duplicate provider-order creation and the confusing "two payment
  // popups" UX. Deliberately per-service-instance (not per-order): resolves to whichever
  // payForOrder() call is already running, rather than letting a second one start.
  private inFlight: Promise<boolean> | null = null;

  /**
   * `amountOverride` covers the C9 mixed-payment case: when part of the order was already paid
   * via wallet, the Razorpay leg must charge only what's left, not the full order total — the
   * backend rejects a mismatched amount (see PaymentsService.createPayment's remaining-amount
   * check), so this must match exactly what the wallet-apply call reported as remaining.
   */
  async payForOrder(order: OrderResponseDto, amountOverride?: number): Promise<boolean> {
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.doPayForOrder(order, amountOverride).finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async doPayForOrder(order: OrderResponseDto, amountOverride?: number): Promise<boolean> {
    try {
      const created = unwrap(
        await this.paymentsService.paymentsControllerCreatePayment({
          // Order amounts come back from the API as Prisma Decimal values serialized to
          // strings (e.g. "459.00") despite the SDK typing them as number — coerce explicitly.
          body: { orderId: order.id, amount: amountOverride ?? Number(order.totalAmount) },
        }),
      );

      const result = await this.razorpayCheckout.open({
        orderId: created.providerOrder.id,
        amount: created.providerOrder.amount,
        currency: created.providerOrder.currency,
        name: 'Patheya Express',
        description: `Order ${order.orderNumber}`,
      });

      await this.paymentsService.paymentsControllerVerifyPayment({
        body: {
          razorpay_order_id: result.razorpay_order_id,
          razorpay_payment_id: result.razorpay_payment_id,
          razorpay_signature: result.razorpay_signature,
        },
      });

      return true;
    } catch {
      return false;
    }
  }
}
