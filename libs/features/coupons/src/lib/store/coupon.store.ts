import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { CouponResponseDto, PricingResultResponseDto } from '@patheya-express-frontend/api-sdk';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { CouponsService } from '../services/coupons.service';

function extractMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
    return error.error.message;
  }
  return fallback;
}

/**
 * Equality for the `appliedCoupon` signal. Every successful validate() call returns a
 * freshly-deserialized coupon object, never reference-equal to the previous one even when it's
 * logically the same coupon — so this can't be reference equality. It also can't be `id`-only
 * equality: that would silently freeze every *other* field (active, maxDiscountAmount,
 * usageLimit, ...) for as long as the coupon stays applied, which would go unnoticed today (only
 * `.code` is read reactively) but would be a real footgun for e.g. a future "uses remaining"
 * indicator reading a field this comparator ignored.
 *
 * Compares every field except `totalUsed` and `updatedAt`, which are excluded deliberately:
 * `totalUsed` increments on *any* redemption of this coupon by *any* customer, and `updatedAt`
 * on unrelated admin edits — neither reflects whether it's still meaningfully "the same applied
 * coupon" for this checkout, and treating them as significant here would reintroduce spurious
 * re-validation loops on a shared/platform-wide coupon under concurrent use elsewhere.
 */
function isSameAppliedCoupon(a: CouponResponseDto | null, b: CouponResponseDto | null): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.id === b.id &&
    a.code === b.code &&
    a.active === b.active &&
    a.type === b.type &&
    a.value === b.value &&
    a.scope === b.scope &&
    a.restaurantId === b.restaurantId &&
    a.minOrderAmount === b.minOrderAmount &&
    a.maxDiscountAmount === b.maxDiscountAmount &&
    a.usageLimit === b.usageLimit &&
    a.usagePerUser === b.usagePerUser &&
    a.startsAt === b.startsAt &&
    a.endsAt === b.endsAt &&
    a.name === b.name &&
    a.description === b.description &&
    a.createdAt === b.createdAt
  );
}

@Injectable({ providedIn: 'root' })
export class CouponStore {
  private readonly couponsService = inject(CouponsService);

  private readonly _availableCoupons = signal<CouponResponseDto[]>([]);
  // See isSameAppliedCoupon() above: this stops CheckoutStore's re-validation effect from
  // re-triggering itself every time its own refresh() call resolves, without freezing fields a
  // future consumer might reasonably read reactively. The separate `_pricing` signal below still
  // updates unconditionally, so the displayed discount/total stay accurate on every refresh.
  private readonly _appliedCoupon = signal<CouponResponseDto | null>(null, {
    equal: isSameAppliedCoupon,
  });
  private readonly _pricing = signal<PricingResultResponseDto | null>(null);
  private readonly _loading = signal(false);
  private readonly _validationError = signal<string | null>(null);

  readonly availableCoupons = this._availableCoupons.asReadonly();
  readonly appliedCoupon = this._appliedCoupon.asReadonly();
  /** Full server-computed pricing preview for the currently applied coupon — null when none is applied. */
  readonly pricing = this._pricing.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly validationError = this._validationError.asReadonly();

  readonly discountAmount = computed(() => this._pricing()?.discountAmount ?? 0);
  /** What the order total would be with the applied coupon — null when no coupon is applied, so callers fall back to their own no-coupon total. */
  readonly finalTotal = computed(() => this._pricing()?.totalAmount ?? null);

  constructor() {
    inject(LogoutCleanupRegistry).register(() => this.reset());
  }

  async loadAvailable(restaurantId?: string): Promise<void> {
    try {
      const coupons = await this.couponsService.getAvailable(restaurantId);
      this._availableCoupons.set(coupons);
    } catch {
      this._availableCoupons.set([]);
    }
  }

  /** Validates `code` against the given cart and, on success, applies it — replacing any previously applied coupon. */
  async apply(code: string, restaurantId: string, subtotal: number): Promise<boolean> {
    this._loading.set(true);
    this._validationError.set(null);

    try {
      const result = await this.couponsService.validate({
        code: code.trim().toUpperCase(),
        restaurantId,
        subtotal,
      });
      this._appliedCoupon.set(result.coupon);
      this._pricing.set(result.pricing);
      return true;
    } catch (err) {
      this._appliedCoupon.set(null);
      this._pricing.set(null);
      this._validationError.set(extractMessage(err, 'This coupon could not be applied.'));
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Re-validates the currently applied coupon against a new subtotal — call whenever the cart
   * changes while a coupon is applied, so the discount preview stays accurate and a coupon that's
   * no longer eligible (e.g. subtotal fell below minOrderAmount) is dropped with a clear reason.
   */
  async refresh(restaurantId: string, subtotal: number): Promise<void> {
    const coupon = this._appliedCoupon();
    if (!coupon) {
      return;
    }
    await this.apply(coupon.code, restaurantId, subtotal);
  }

  remove(): void {
    this._appliedCoupon.set(null);
    this._pricing.set(null);
    this._validationError.set(null);
  }

  reset(): void {
    this._availableCoupons.set([]);
    this._loading.set(false);
    this.remove();
    this.couponsService.clearRememberedCodes();
  }

  rememberCodeForOrder(orderId: string, code: string): void {
    this.couponsService.rememberCodeForOrder(orderId, code);
  }

  getCodeForOrder(orderId: string): string | null {
    return this.couponsService.getCodeForOrder(orderId);
  }
}
