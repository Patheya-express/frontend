import type { HttpInterceptorFn } from '@angular/common/http';
import { Observable, race, throwError } from 'rxjs';
import { RequestCanceledError } from '../errors/network-error';
import { REQUEST_ABORT_SIGNAL } from './cancellation.token';

/**
 * Opt-in request cancellation via the standard `AbortSignal` primitive, carried on `HttpContext`
 * (see `cancellation.token.ts`). A complete no-op for the overwhelming majority of requests, which
 * never attach a signal — nothing changes for them, including every existing mutation, checkout,
 * payment, and auth call, none of which pass a `context` today. This exists as a shared primitive
 * for the naturally-cancelable case the M2 audit calls out (search/autocomplete/filter-as-you-type
 * requests); no existing feature was refactored to consume it, since none currently needs it.
 *
 * Registered last (closest to the backend) in `withInterceptors([...])` so canceling unsubscribes
 * from the most literal request Observable available and Angular's own HTTP backend aborts the
 * underlying XHR — this is Angular's native cancellation mechanism (unsubscription), just wired to
 * a signal instead of requiring the caller to hold and unsubscribe from a `Subscription` directly,
 * which the generated SDK doesn't expose (every generated service method returns a `Promise`, not
 * an `Observable` — see `Api`/`BaseService`'s generated `firstValueFrom(...)` wrapping).
 */
export const cancellationInterceptor: HttpInterceptorFn = (req, next) => {
  const signal = req.context.get(REQUEST_ABORT_SIGNAL);

  if (!signal) {
    return next(req);
  }

  if (signal.aborted) {
    return throwError(() => new RequestCanceledError(req.url));
  }

  const aborted$ = new Observable<never>((subscriber) => {
    const onAbort = () => subscriber.error(new RequestCanceledError(req.url));
    signal.addEventListener('abort', onAbort, { once: true });
    return () => signal.removeEventListener('abort', onAbort);
  });

  // `race` subscribes to both and, whichever settles first, unsubscribes from the other — if
  // `aborted$` fires first, that unsubscribes from `next(req)`, which is what actually aborts the
  // underlying HTTP request rather than merely abandoning interest in its result.
  return race(next(req), aborted$);
};
