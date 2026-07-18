import { Injectable, inject } from '@angular/core';
import { APP_ENVIRONMENT } from '../environment/app-environment';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

export interface RazorpayCheckoutOptions {
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefillEmail?: string;
  prefillContact?: string;
}

export interface RazorpayPaymentResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: unknown) => { open(): void };
  }
}

/** Lazily loads and wraps the Razorpay Checkout widget (checkout.js) for one-off payment collection. */
@Injectable({ providedIn: 'root' })
export class RazorpayCheckoutService {
  private readonly environment = inject(APP_ENVIRONMENT);

  private scriptPromise: Promise<void> | null = null;

  private loadScript(): Promise<void> {
    if (window.Razorpay) {
      return Promise.resolve();
    }

    if (!this.scriptPromise) {
      this.scriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = RAZORPAY_SCRIPT_URL;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
        document.body.appendChild(script);
      });
    }

    return this.scriptPromise;
  }

  /** Opens the checkout widget and resolves with the payment result, or rejects if cancelled/failed. */
  async open(options: RazorpayCheckoutOptions): Promise<RazorpayPaymentResult> {
    await this.loadScript();

    const RazorpayCtor = window.Razorpay;

    if (!RazorpayCtor) {
      throw new Error('Razorpay checkout is unavailable');
    }

    return new Promise<RazorpayPaymentResult>((resolve, reject) => {
      const razorpay = new RazorpayCtor({
        key: this.environment.razorpayKeyId,
        order_id: options.orderId,
        amount: options.amount,
        currency: options.currency,
        name: options.name,
        description: options.description,
        prefill: {
          email: options.prefillEmail,
          contact: options.prefillContact,
        },
        handler: (response: RazorpayPaymentResult) => resolve(response),
        modal: {
          ondismiss: () => reject(new Error('Payment cancelled')),
        },
      });

      razorpay.open();
    });
  }
}
