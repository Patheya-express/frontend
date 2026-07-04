import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '../facades/auth.facade';

/** Redirects already-authenticated users away from guest-only routes (e.g. login/register). */
export const guestGuard: CanActivateFn = () => {
  const facade = inject(AuthFacade);
  const router = inject(Router);

  if (!facade.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/']);
};
