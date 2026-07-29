import { Injectable, inject } from '@angular/core';
import {
  CouponsService as CouponsApiService,
  type CouponResponseDto,
  type CouponValidationResponseDto,
  type ValidateCouponDto,
} from '@patheya-express-frontend/api-sdk';

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

const ORDER_CODE_STORAGE_PREFIX = 'patheya:coupon-code:';

/** Thin wrapper around the backend Coupons API — customer-facing surface only (validate/browse). */
@Injectable({ providedIn: 'root' })
export class CouponsService {
  private readonly couponsApi = inject(CouponsApiService);

  async validate(dto: ValidateCouponDto): Promise<CouponValidationResponseDto> {
    return unwrap(await this.couponsApi.couponsControllerValidate({ body: dto }));
  }

  async getAvailable(restaurantId?: string): Promise<CouponResponseDto[]> {
    return unwrap(await this.couponsApi.couponsControllerGetAvailable({ restaurantId }));
  }

  /**
   * Remembers which code was redeemed on an order, for same-session display on Order Details.
   * `OrderResponseDto` only carries `couponId` (not the human-readable code), and resolving a code
   * from an id requires the admin-only `GET /coupons/:id` endpoint, which customers can't call —
   * so this is a deliberate client-side bridge, not a substitute for a real join. It only survives
   * the current browser session/tab; it's not expected to resolve for orders viewed later, on a
   * different device, or after a session restart.
   */
  rememberCodeForOrder(orderId: string, code: string): void {
    try {
      sessionStorage.setItem(ORDER_CODE_STORAGE_PREFIX + orderId, code);
    } catch {
      // sessionStorage unavailable (e.g. private browsing) — the code just won't be shown later.
    }
  }

  getCodeForOrder(orderId: string): string | null {
    try {
      return sessionStorage.getItem(ORDER_CODE_STORAGE_PREFIX + orderId);
    } catch {
      return null;
    }
  }

  /** Called on logout — these are account-linked (which code this customer used on which order),
   *  so they shouldn't outlive the session, even though the risk is low (just promo code text). */
  clearRememberedCodes(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(ORDER_CODE_STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        sessionStorage.removeItem(key);
      }
    } catch {
      // sessionStorage unavailable — nothing to clear.
    }
  }
}
