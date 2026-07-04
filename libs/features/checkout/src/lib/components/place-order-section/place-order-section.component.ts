import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CheckoutFacade } from '../../facades/checkout.facade';

@Component({
  selector: 'lib-place-order-section',
  standalone: true,
  templateUrl: './place-order-section.component.html',
  styleUrl: './place-order-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceOrderSectionComponent {
  private readonly checkoutFacade = inject(CheckoutFacade);
  private readonly router = inject(Router);

  protected readonly placingOrder = this.checkoutFacade.placingOrder;
  protected readonly validationErrors = this.checkoutFacade.validationErrors;
  protected readonly error = this.checkoutFacade.error;

  protected async placeOrder(): Promise<void> {
    const order = await this.checkoutFacade.placeOrder();

    if (order) {
      await this.router.navigateByUrl(`/orders/${order.id}`);
    }
  }
}
