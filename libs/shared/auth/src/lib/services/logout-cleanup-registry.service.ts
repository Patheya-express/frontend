import { Injectable } from '@angular/core';

/**
 * Shared root registry of "run this when the user logs out" callbacks. AuthStore owns only the
 * access/refresh token and the auth user signal — it has no knowledge of carts, profiles,
 * sockets, coupons, or any other feature/domain state (those live in `libs/features/*` and
 * `libs/shared/core`, layers that already depend on `libs/shared/auth`, so `shared/auth` can
 * never import back from them). Rather than have some central place statically import every
 * feature store to wire this up (which, for a lazy-loaded feature like checkout/wallet/favorites,
 * would defeat the whole point of lazy-loading it — `@nx/enforce-module-boundaries` forbids a
 * static import of a lazy-loaded library for exactly this reason), each store/service registers
 * *itself*, in its own constructor: `inject(LogoutCleanupRegistry).register(() => this.reset())`.
 *
 * Since this registry is `providedIn: 'root'` and every store/service that registers into it is
 * also `providedIn: 'root'`, a lazy-loaded store only ever registers once something has actually
 * instantiated it (i.e. the user visited that feature) — nothing forces its chunk to load just to
 * participate in logout, and nothing needs cleaning up for a feature that was never touched
 * anyway. AuthStore.logout() calls `runAll()` after its own teardown (token/user signals +
 * localStorage) has already completed, so a handler can safely assume `isAuthenticated()` is
 * already false by the time it runs. A handler must never throw — `runAll()` catches and logs
 * each one individually so a broken handler can't stop the rest of logout from completing. The
 * same handlers also run on a cross-tab logout sync (see AuthStore's `storage` event listener) —
 * a handler must be safe to call even when this tab never made the server-side logout call itself.
 */
@Injectable({ providedIn: 'root' })
export class LogoutCleanupRegistry {
  private readonly handlers = new Set<() => void>();

  /** Returns an unregister function — not needed by any current caller (every registrant is a
   *  root singleton that lives for the app's whole lifetime), but avoids leaking that as an
   *  assumption into the API itself. */
  register(handler: () => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  runAll(): void {
    for (const handler of this.handlers) {
      try {
        handler();
      } catch (error) {
        console.error('A logout cleanup handler failed', error);
      }
    }
  }
}
