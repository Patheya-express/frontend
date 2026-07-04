import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CheckoutFacade } from '../../facades/checkout.facade';

@Component({
  selector: 'lib-address-section',
  standalone: true,
  templateUrl: './address-section.component.html',
  styleUrl: './address-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressSectionComponent {
  private readonly checkoutFacade = inject(CheckoutFacade);

  protected readonly address = this.checkoutFacade.address;

  protected onAddressChange(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.checkoutFacade.setAddress(value);
  }
}
