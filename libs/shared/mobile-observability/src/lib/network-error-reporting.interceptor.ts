import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import {
  CORRELATION_ID_CONTEXT,
  classifyNetworkError,
} from '@patheya-express-frontend/mobile-networking';
import { LoggerService } from './logger.service';

/**
 * The single, centralized place a failed HTTP request becomes a diagnostic log entry — see
 * M7.11/M7.12. Register this LAST in each app's `withInterceptors([...])` array (closest to the
 * backend), so it observes the raw error before any earlier interceptor's own `catchError` (e.g.
 * `authInterceptor`'s 401 handling) runs, then rethrows it completely unchanged — nothing about
 * the error object itself is touched, so every existing interceptor and facade/store `catch` block
 * still sees the exact same `HttpErrorResponse`/`RequestTimeoutError`/`RequestCanceledError` it
 * always did.
 *
 * Reads the correlation ID `correlationIdInterceptor` already generated for this exact request off
 * `CORRELATION_ID_CONTEXT` (M2, extended — never a second ID). Every category is logged, never
 * captured as a crash: a network failure is expected/operational by nature (see
 * `classifyNetworkError`'s own categories), and feature code already decides what to do about it
 * in its own catch block — this interceptor's only job is making sure *some* diagnostic trail
 * exists for network failures even when nothing else happens to log one, without duplicating
 * whatever that feature code separately reports.
 */
export const networkErrorReportingInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const category = classifyNetworkError(error);
      logger.warn('http_request_failed', {
        errorClassification: category,
        correlationId: req.context.get(CORRELATION_ID_CONTEXT),
      });
      return throwError(() => error);
    }),
  );
};
