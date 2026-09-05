import type { HttpInterceptorFn } from '@angular/common/http';
import { CORRELATION_ID_CONTEXT, generateRequestId, REQUEST_ID_HEADER } from './correlation-id';

/**
 * Stamps every outgoing request with a fresh `X-Request-Id` header — one ID per logical
 * client-initiated request, not one per wire-level attempt.
 *
 * Registered *before* `authInterceptor` in every app's `withInterceptors([...])` array
 * (`app.config.ts`) specifically so that guarantee holds across a silent-refresh retry:
 * `authInterceptor` builds both its authorized attempt and its post-refresh retry by cloning the
 * same `req` this interceptor already stamped (`req.clone({ setHeaders: { Authorization: ... } })`
 * — `clone` merges headers, it doesn't replace them), so the header — and therefore the ID —
 * survives onto the retry unchanged. One logical operation that happened to need a token refresh
 * in the middle keeps one traceable ID, rather than fragmenting into two unrelated ones. The
 * refresh call itself is a separate top-level `HttpClient` request and re-enters this interceptor
 * from the top of the chain, so it correctly gets its own distinct ID.
 *
 * Sets a header only — never touches `req.url` or `req.params`, so the ID can never leak into a
 * URL or query string.
 */
export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  const id = generateRequestId();
  return next(
    req.clone({
      setHeaders: { [REQUEST_ID_HEADER]: id },
      context: req.context.set(CORRELATION_ID_CONTEXT, id),
    }),
  );
};
