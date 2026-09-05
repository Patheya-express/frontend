import { HttpErrorResponse } from '@angular/common/http';

/**
 * Thrown by `httpTimeoutInterceptor` in place of RxJS's own `TimeoutError` — decouples
 * `classifyNetworkError` (and anything else higher up) from an RxJS-internal type, and carries
 * the request URL/timeout for anyone who wants to log it (metadata only — see the interceptor's
 * own doc comment on why the URL alone is safe to include).
 */
export class RequestTimeoutError extends Error {
  override readonly name = 'RequestTimeoutError';

  constructor(
    readonly url: string,
    readonly timeoutMs: number,
  ) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
  }
}

/** Thrown by `cancellationInterceptor` when the caller-supplied `AbortSignal` fires. */
export class RequestCanceledError extends Error {
  override readonly name = 'RequestCanceledError';

  constructor(readonly url: string) {
    super(`Request to ${url} was canceled`);
  }
}

/**
 * The minimum set of categories M2 needs so higher layers (facades, stores, future UI error
 * mapping) can react appropriately without each one re-deriving it from a raw `HttpErrorResponse`.
 * Deliberately flat and small — this is a classification, not a replacement for the backend's own
 * error body/shape, which callers can still read off the original `HttpErrorResponse` themselves.
 */
export type NetworkErrorCategory =
  | 'timeout'
  | 'canceled'
  | 'offline'
  | 'unauthorized'
  | 'forbidden'
  | 'client-error'
  | 'server-error'
  | 'unknown';

/**
 * Classifies a failed HTTP request into one of `NetworkErrorCategory`, without changing,
 * unwrapping, or swallowing the original error — callers still get to inspect the real
 * `HttpErrorResponse` (status, body, headers) themselves; this only adds a coarse label on top.
 *
 * Deliberately a plain function, not an interceptor: `authInterceptor`'s 401 handling,
 * single-flight refresh, and logout behavior depend on seeing the raw, untouched
 * `HttpErrorResponse` (`error.status === 401`, `req.url.includes(REFRESH_URL_FRAGMENT)`, etc.) —
 * putting classification in the interceptor chain would risk that. Calling this function from a
 * feature facade/store's own `catch` block instead means it can never interfere with the auth
 * flow no matter where interceptors are ordered.
 *
 * `status === 0` (no response ever came back — DNS failure, connection refused, CORS, or the
 * device genuinely being offline) is classified as `'offline'`. This is a property of *this one
 * failed request*, not a global connectivity assertion — it does not read `NetworkStatusService`
 * and callers should keep using that service as the source of truth for "is the device online."
 * A `'timeout'` is never reclassified as `'offline'` here, and vice versa — per M2 scope, a slow
 * server and no connectivity are kept distinguishable rather than collapsed into one bucket.
 */
export function classifyNetworkError(error: unknown): NetworkErrorCategory {
  if (error instanceof RequestTimeoutError) {
    return 'timeout';
  }

  if (error instanceof RequestCanceledError) {
    return 'canceled';
  }

  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'offline';
    }
    if (error.status === 401) {
      return 'unauthorized';
    }
    if (error.status === 403) {
      return 'forbidden';
    }
    if (error.status >= 500) {
      return 'server-error';
    }
    if (error.status >= 400) {
      return 'client-error';
    }
  }

  return 'unknown';
}
