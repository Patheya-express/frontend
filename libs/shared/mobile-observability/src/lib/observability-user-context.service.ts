import { Injectable, effect, inject } from '@angular/core';
import * as Sentry from '@sentry/capacitor';
import { AuthFacade, LogoutCleanupRegistry } from '@patheya-express-frontend/auth';

/**
 * Keeps Sentry's user context in sync with `AuthFacade.user()` — see M7.13. Only the user's own
 * `id` (never email/name — those are PII) plus their `role` (a coarse, non-identifying category
 * tag, useful for triage: "is this crash specific to DELIVERY_PARTNER accounts") are attached.
 * Never access/refresh tokens, never anything from `AuthStore`'s token storage.
 *
 * Follows the exact same shape as `PushNotificationsService`/`RealtimeSocketService`: a root
 * singleton that registers its own cleanup with `LogoutCleanupRegistry` in its constructor (no
 * redesign of that registry — see M7's explicit "preserve LogoutCleanupRegistry architecture") and
 * reacts to auth state via its own `effect()`, so nothing in `app.ts` needs to know this service
 * exists — `provideMobileObservability()` eagerly instantiates it once at bootstrap.
 */
@Injectable({ providedIn: 'root' })
export class ObservabilityUserContextService {
  private readonly authFacade = inject(AuthFacade);

  constructor() {
    inject(LogoutCleanupRegistry).register(() => this.clear());

    effect(() => {
      const user = this.authFacade.user();
      if (user) {
        this.setUser(user.id, user.role);
      } else {
        this.clear();
      }
    });
  }

  private setUser(id: string, role: string): void {
    try {
      Sentry.setUser({ id });
      Sentry.setTag('user_role', role);
    } catch {
      // Reporting must never throw back into the auth flow.
    }
  }

  clear(): void {
    try {
      Sentry.setUser(null);
      Sentry.setTag('user_role', undefined);
    } catch {
      // Reporting must never throw back into the logout flow.
    }
  }
}
