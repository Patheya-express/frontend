import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import type { AuthUserDto } from '@patheya-express-frontend/api-sdk';
import { AuthFacade } from '../facades/auth.facade';

export type AppUserRole = AuthUserDto['role'];

/**
 * Factory returning a CanActivateFn scoped to the given roles — use as
 * `canActivate: [authGuard, roleGuard(['RESTAURANT_OWNER'])]`. Route-level only; the backend
 * remains the real authorization boundary. This redirects a logged-in user of the wrong role
 * away from the page (rather than letting them hit a confusing 403 from the API) — pair with
 * authGuard so unauthenticated users are sent to login first.
 */
export function roleGuard(allowedRoles: AppUserRole[]): CanActivateFn {
  return () => {
    const facade = inject(AuthFacade);
    const router = inject(Router);

    const role = facade.user()?.role;

    if (role && allowedRoles.includes(role)) {
      return true;
    }

    return router.createUrlTree(['/']);
  };
}
