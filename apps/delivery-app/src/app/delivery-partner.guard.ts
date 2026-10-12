import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { ToastService } from '@patheya-express-frontend/ui';

/**
 * `/auth/login` is shared by every role, so a customer or restaurant account can sign in to this
 * app successfully. Without this guard such a user landed in the delivery onboarding wizard (the
 * onboarding guard treats "no partner profile" as "start onboarding"). The shared `roleGuard`
 * can't be used here: it redirects to `/`, which in this app sends an authenticated user back to
 * `/dashboard` — a redirect loop. Instead the session is ended and the user is told why. The
 * backend remains the real authorization boundary; this is UX only.
 */
export const deliveryPartnerGuard: CanActivateFn = async () => {
  const authFacade = inject(AuthFacade);
  const router = inject(Router);
  const toastService = inject(ToastService);

  // Unauthenticated is authGuard's case (Angular evaluates sibling guards together, so this must
  // not log out/toast for a visitor who simply isn't signed in yet).
  if (
    !authFacade.isAuthenticated() ||
    authFacade.user()?.role === 'DELIVERY_PARTNER'
  ) {
    return true;
  }

  await authFacade.logout();
  toastService.showSnackbar({
    message:
      'This app is for delivery partners. Log in with your delivery partner account.',
    tone: 'error',
  });

  return router.createUrlTree(['/auth/login']);
};
