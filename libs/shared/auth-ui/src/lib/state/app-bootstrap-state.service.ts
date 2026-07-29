import { Injectable, signal } from '@angular/core';

/**
 * Tracks whether `SplashPageComponent` has finished running this session's startup work
 * (session restore is already synchronous/instant via `AuthFacade.initialize()` in
 * `provideAppInitializer`; this is specifically about the *async* app-specific initializers
 * registered via `SPLASH_INITIALIZERS`, e.g. restoring a signed-in customer's cart). Deliberately
 * NOT persisted (in-memory only) — every fresh app launch/reload should see the splash again,
 * this only prevents re-showing it on in-session client-side navigations.
 */
@Injectable({ providedIn: 'root' })
export class AppBootstrapStateService {
  private readonly _splashCompleted = signal(false);

  readonly splashCompleted = this._splashCompleted.asReadonly();

  markSplashCompleted(): void {
    this._splashCompleted.set(true);
  }
}
