import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EmptyStateComponent } from '@patheya-express-frontend/ui';
import { CheckoutFacade } from '../../facades/checkout.facade';
import { AddressSectionComponent } from '../../components/address-section/address-section.component';
import { OrderSummaryComponent } from '../../components/order-summary/order-summary.component';
import { PriceBreakdownComponent } from '../../components/price-breakdown/price-breakdown.component';
import { PlaceOrderSectionComponent } from '../../components/place-order-section/place-order-section.component';

@Component({
  selector: 'lib-checkout-page',
  standalone: true,
  imports: [
    EmptyStateComponent,
    AddressSectionComponent,
    OrderSummaryComponent,
    PriceBreakdownComponent,
    PlaceOrderSectionComponent,
  ],
  templateUrl: './checkout-page.component.html',
  styleUrl: './checkout-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPageComponent {
  private readonly checkoutFacade = inject(CheckoutFacade);
  private readonly router = inject(Router);

  protected readonly isEmpty = computed(() => this.checkoutFacade.orderSummary().items.length === 0);

  protected browseRestaurants(): void {
    void this.router.navigateByUrl('/');
  }
}
