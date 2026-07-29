import { inject } from '@angular/core';
import { Router, type CanActivateChildFn } from '@angular/router';
import { AppBootstrapStateService } from '../state/app-bootstrap-state.service';

/**
 * Applied as `canActivateChild` on the app's route tree (wrapping every existing route — see
 * `apps/customer-app/src/app/app.routes.ts`) so the very first navigation of a session goes
 * through `/splash` first, preserving the originally-requested URL to resume afterward. Once
 * `AppBootstrapStateService` reports the splash has run, every subsequent in-session navigation
 * passes straight through — this only fires once per app load, not on every route change.
 */
export const splashGuard: CanActivateChildFn = (_childRoute, state) => {
  const bootstrapState = inject(AppBootstrapStateService);
  const router = inject(Router);

  if (bootstrapState.splashCompleted()) {
    return true;
  }

  return router.createUrlTree(['/splash'], { queryParams: { redirectTo: state.url } });
};
