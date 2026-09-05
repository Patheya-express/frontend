import { ErrorHandler, type EnvironmentProviders, inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { LoggerService } from './logger.service';
import { ObservabilityErrorHandler } from './observability-error-handler';
import { ObservabilityUserContextService } from './observability-user-context.service';

/**
 * Registers the M7 Angular-side observability wiring — mirrors `provideMobilePlatform()`'s
 * `provideXxx()` idiom (`mobile.providers.ts`). Each app adds exactly this one call to its
 * `app.config.ts`. Does NOT call `initMobileObservability()` — that runs earlier, as a plain
 * function at the top of `main.ts`, before Angular even bootstraps (see that function's own doc
 * comment for why).
 *
 * Bundles:
 * - The global `ErrorHandler` override (M7.5).
 * - `LoggerService.configure(environmentName)`, so the "no debug breadcrumbs outside local dev"
 *   rule (M7.20) applies without every call site knowing the current environment.
 * - Eager instantiation of `ObservabilityUserContextService` — its own constructor does all the
 *   real work (reacting to `AuthFacade.user()`, registering with `LogoutCleanupRegistry`); nothing
 *   here needs its public API, so nothing would ever trigger Angular to create it otherwise.
 *
 * `provideAppInitializer` runs after bootstrap succeeds, so it cannot fail startup itself in the
 * way a rejected initializer normally would block rendering — but it is still wrapped defensively
 * since a component elsewhere might be waiting on other initializers in the same array.
 */
export function provideMobileObservability(environmentName: string): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ErrorHandler, useClass: ObservabilityErrorHandler },
    provideAppInitializer(() => {
      try {
        inject(LoggerService).configure(environmentName);
        inject(ObservabilityUserContextService);
      } catch {
        // Never let observability wiring block the rest of app startup.
      }
    }),
  ]);
}
