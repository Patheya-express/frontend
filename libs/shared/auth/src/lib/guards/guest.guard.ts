import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '../facades/auth.facade';

/**
 * Redirects already-authenticated users away from guest-only routes (e.g. login/register).
 * Falls back to `/`, or to route data's `homePath` when `/` is a public marketing page rather
 * than the authenticated home (see login-page.component.ts for the matching post-login case).
 */
export const guestGuard: CanActivateFn = (route) => {
  const facade = inject(AuthFacade);
  const router = inject(Router);

  if (!facade.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree([(route.data['homePath'] as string | undefined) ?? '/']);
};
