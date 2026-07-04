import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '../facades/auth.facade';

/** Blocks access to protected routes unless the user is authenticated. */
export const authGuard: CanActivateFn = (_route, state) => {
  const facade = inject(AuthFacade);
  const router = inject(Router);

  if (facade.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/login'], { queryParams: { redirectTo: state.url } });
};
