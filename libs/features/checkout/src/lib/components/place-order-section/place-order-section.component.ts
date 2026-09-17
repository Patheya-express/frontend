import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PrimaryButtonComponent, ToastService } from '@patheya-express-frontend/ui';
import { HapticsService } from '@patheya-express-frontend/core';
import { LiveOrdersFacade } from '@patheya-express-frontend/live-orders';
import { CheckoutFacade } from '../../facades/checkout.facade';

@Component({
  selector: 'lib-place-order-section',
  standalone: true,
  imports: [PrimaryButtonComponent],
  templateUrl: './place-order-section.component.html',
  styleUrl: './place-order-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceOrderSectionComponent {
  private readonly checkoutFacade = inject(CheckoutFacade);
  private readonly router = inject(Router);
  private readonly haptics = inject(HapticsService);
  private readonly toastService = inject(ToastService);
  private readonly liveOrdersFacade = inject(LiveOrdersFacade);

  protected readonly placingOrder = this.checkoutFacade.placingOrder;
  protected readonly validationErrors = this.checkoutFacade.validationErrors;
  protected readonly error = this.checkoutFacade.error;

  protected async placeOrder(): Promise<void> {
    const order = await this.checkoutFacade.placeOrder();

    if (!order) {
      void this.haptics.error();
      return;
    }

    // CheckoutStore.placeOrder() sets `error` (without failing the call) when the order was
    // created but its online-payment leg did not complete — the order exists and is retryable
    // from its details page, but it is NOT a successful placement. Only the absence of that error
    // means payment actually completed (or wasn't required: COD, or fully wallet-covered).
    const paymentError = this.checkoutFacade.error();

    if (paymentError) {
      void this.haptics.error();
      // ToastHostComponent lives in the app shell, above the router-outlet, so this survives the
      // navigation below and plays its slide+fade entrance on the order details page.
      this.toastService.showToast({ message: paymentError, tone: 'error' });
      await this.router.navigateByUrl(`/orders/${order.id}`);
      return;
    }

    // Reuses the existing order-state architecture directly (no refetch, no race with Home's own
    // load) — by the time Home mounts, LiveOrdersFacade already knows about this order and the
    // floating tracker shows it immediately.
    this.liveOrdersFacade.upsertOrder(order);

    void this.haptics.success();
    this.toastService.showToast({ message: 'Order placed ✓', tone: 'success' });
    await this.router.navigateByUrl('/');
  }
}
