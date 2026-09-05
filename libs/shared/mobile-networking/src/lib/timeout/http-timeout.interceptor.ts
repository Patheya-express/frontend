import type { HttpInterceptorFn } from '@angular/common/http';
import { TimeoutError, catchError, throwError, timeout } from 'rxjs';
import { RequestTimeoutError } from '../errors/network-error';
import {
  DEFAULT_HTTP_TIMEOUT_MS,
  UPLOAD_HTTP_TIMEOUT_MS,
} from './http-timeout.constants';

/**
 * Bounds every outgoing request so it can never hang indefinitely — the audit's own finding was
 * that no interceptor did this at all. Registered *after* `authInterceptor` in every app's
 * `withInterceptors([...])` array so each real wire attempt gets its own fresh timeout window:
 * `authInterceptor` calls `next()` once for the original attempt and, on a 401-then-successful-
 * refresh, again for the retry — each of those `next()` calls re-enters this interceptor
 * independently. Placing the timeout *before* auth instead would let one shared budget cover the
 * original attempt, the refresh, and the retry combined, which is exactly the "timeout
 * accidentally terminates refresh logic" failure mode this ordering avoids.
 *
 * On expiry, RxJS's `timeout()` operator itself unsubscribes from the underlying request — which
 * is what actually aborts the in-flight XHR — and this interceptor re-throws that as a
 * `RequestTimeoutError` rather than leaving RxJS's own `TimeoutError` to leak through (see that
 * class's doc comment for why). Any other error is passed through unchanged, so this never
 * interferes with `authInterceptor`'s own `catchError`/401 handling downstream of it in the
 * response direction.
 */
export const httpTimeoutInterceptor: HttpInterceptorFn = (req, next) => {
  const timeoutMs =
    req.body instanceof FormData
      ? UPLOAD_HTTP_TIMEOUT_MS
      : DEFAULT_HTTP_TIMEOUT_MS;

  return next(req).pipe(
    timeout(timeoutMs),
    catchError((error: unknown) => {
      if (error instanceof TimeoutError) {
        return throwError(() => new RequestTimeoutError(req.url, timeoutMs));
      }
      return throwError(() => error);
    }),
  );
};
