import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PrimaryButtonComponent, ToastService } from '@patheya-express-frontend/ui';
import { HapticsService } from '@patheya-express-frontend/core';
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

  protected readonly placingOrder = this.checkoutFacade.placingOrder;
  protected readonly validationErrors = this.checkoutFacade.validationErrors;
  protected readonly error = this.checkoutFacade.error;

  protected async placeOrder(): Promise<void> {
    const order = await this.checkoutFacade.placeOrder();

    if (order) {
      void this.haptics.success();
      // ToastHostComponent lives in the app shell, above the router-outlet, so this survives the
      // navigation below and plays its slide+fade entrance on the order details page.
      this.toastService.showToast({ message: 'Order placed ✓', tone: 'success' });
      await this.router.navigateByUrl(`/orders/${order.id}`);
    } else {
      void this.haptics.error();
    }
  }
}
