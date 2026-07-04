import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { AuthFacade } from '../facades/auth.facade';

/** Attaches the stored bearer access token to outgoing requests, when present. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const accessToken = inject(AuthFacade).getAccessToken();

  if (!accessToken) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${accessToken}` },
    }),
  );
};
