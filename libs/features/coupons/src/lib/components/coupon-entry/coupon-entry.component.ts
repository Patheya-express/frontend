import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { PrimaryButtonComponent, SearchInputComponent, StatusChipComponent } from '@patheya-express-frontend/ui';
import { CouponFacade } from '../../facades/coupon.facade';

/** Coupon entry + applied-state chip for Checkout — apply/remove a promo code against the current cart. */
@Component({
  selector: 'lib-coupon-entry',
  standalone: true,
  imports: [PrimaryButtonComponent, SearchInputComponent, StatusChipComponent],
  templateUrl: './coupon-entry.component.html',
  styleUrl: './coupon-entry.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CouponEntryComponent {
  protected readonly couponFacade = inject(CouponFacade);

  readonly restaurantId = input.required<string>();
  readonly subtotal = input.required<number>();

  protected readonly code = signal('');

  protected onCodeChange(value: string): void {
    this.code.set(value.toUpperCase());
  }

  protected async applyCoupon(): Promise<void> {
    const code = this.code().trim();
    if (!code) {
      return;
    }

    const applied = await this.couponFacade.apply(code, this.restaurantId(), this.subtotal());
    if (applied) {
      this.code.set('');
    }
  }

  protected removeCoupon(): void {
    this.couponFacade.remove();
    this.code.set('');
  }
}
