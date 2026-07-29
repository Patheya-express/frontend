import { Injectable, inject } from '@angular/core';
import { CouponStore } from '../store/coupon.store';

@Injectable({ providedIn: 'root' })
export class CouponFacade {
  private readonly store = inject(CouponStore);

  readonly availableCoupons = this.store.availableCoupons;
  readonly appliedCoupon = this.store.appliedCoupon;
  readonly pricing = this.store.pricing;
  readonly discountAmount = this.store.discountAmount;
  readonly finalTotal = this.store.finalTotal;
  readonly loading = this.store.loading;
  readonly validationError = this.store.validationError;

  loadAvailable(restaurantId?: string): Promise<void> {
    return this.store.loadAvailable(restaurantId);
  }

  apply(code: string, restaurantId: string, subtotal: number): Promise<boolean> {
    return this.store.apply(code, restaurantId, subtotal);
  }

  refresh(restaurantId: string, subtotal: number): Promise<void> {
    return this.store.refresh(restaurantId, subtotal);
  }

  remove(): void {
    this.store.remove();
  }

  rememberCodeForOrder(orderId: string, code: string): void {
    this.store.rememberCodeForOrder(orderId, code);
  }

  getCodeForOrder(orderId: string): string | null {
    return this.store.getCodeForOrder(orderId);
  }

  reset(): void {
    this.store.reset();
  }
}
