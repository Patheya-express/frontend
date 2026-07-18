import { inject } from '@angular/core';
import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthFacade } from '../facades/auth.facade';

const REFRESH_URL_FRAGMENT = '/auth/refresh';

// Module-level, not a class field: every request runs this same interceptor function instance,
// so concurrent 401s (e.g. a page firing several requests at once right as the token expires)
// share one in-flight refresh instead of each independently racing to refresh/rotate the token.
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Attaches the stored bearer access token to outgoing requests, and — the piece that was
 * previously entirely missing — retries a request exactly once after a silent refresh if it
 * 401s. If the refresh itself fails (refresh token expired/revoked), forces a full logout via
 * AuthStore rather than leaving the app in a broken logged-in-looking state.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authFacade = inject(AuthFacade);
  const accessToken = authFacade.getAccessToken();

  const authorizedReq = accessToken
    ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      const isAuthError = error instanceof HttpErrorResponse && error.status === 401;

      // Only retry requests we ourselves attached a (now-expired) token to. A 401 from login
      // (wrong credentials) or from the refresh call itself must never trigger another refresh.
      if (!isAuthError || !accessToken || req.url.includes(REFRESH_URL_FRAGMENT)) {
        return throwError(() => error);
      }

      if (!refreshInFlight) {
        refreshInFlight = authFacade.refreshSession().finally(() => {
          refreshInFlight = null;
        });
      }

      return from(refreshInFlight).pipe(
        switchMap((refreshed) => {
          if (!refreshed) {
            return throwError(() => error);
          }

          const newAccessToken = authFacade.getAccessToken();
          const retryReq = newAccessToken
            ? req.clone({ setHeaders: { Authorization: `Bearer ${newAccessToken}` } })
            : req;

          // Deliberately not wrapped in another catchError — a second 401 on the retried
          // request propagates as-is rather than triggering another refresh attempt.
          return next(retryReq);
        }),
      );
    }),
  );
};
