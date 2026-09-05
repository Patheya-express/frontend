import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Carries an optional `AbortSignal` on a request's `HttpContext` — read by
 * `cancellationInterceptor`. Every generated SDK function/service method already accepts an
 * optional trailing `context?: HttpContext` parameter (see `libs/shared/api-sdk`'s `RequestBuilder`
 * and generated `fn/*.ts`/`services/*.service.ts` files), so a caller opts a specific call into
 * cancellation with `withAbortSignal(...)` and nothing else needs to change — no generated file
 * was touched to add this.
 */
export const REQUEST_ABORT_SIGNAL = new HttpContextToken<
  AbortSignal | undefined
>(() => undefined);

/** Builds (or extends) an `HttpContext` carrying `signal`, to pass as a generated call's `context` argument. */
export function withAbortSignal(
  signal: AbortSignal,
  context: HttpContext = new HttpContext(),
): HttpContext {
  return context.set(REQUEST_ABORT_SIGNAL, signal);
}
