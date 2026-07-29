import { InjectionToken } from '@angular/core';

/**
 * App-specific async startup work `SplashPageComponent` waits for and shows a loading state
 * during — e.g. customer-app registers a function that restores the signed-in customer's cart.
 * Kept out of `provideAppInitializer` deliberately: blocking the *entire* app's bootstrap on a
 * network call means a slow/offline connection shows nothing at all (not even a loading
 * indicator) until it resolves or times out. Running it here instead, after bootstrap, means
 * there's always something on screen, and a failure here (see `SplashPageComponent`) can't
 * strand the user — it just proceeds to the requested route regardless.
 *
 * Each app provides its own array (a plain override, not a multi-provider — see
 * `apps/customer-app/src/app/app.config.ts`):
 *
 *   { provide: SPLASH_INITIALIZERS, useFactory: () => [() => ...] }
 */
export const SPLASH_INITIALIZERS = new InjectionToken<Array<() => Promise<unknown>>>(
  'SPLASH_INITIALIZERS',
  { factory: () => [] },
);
