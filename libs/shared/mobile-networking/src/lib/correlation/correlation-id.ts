import { HttpContextToken } from '@angular/common/http';

/**
 * The header name this repo's infra layer already uses for request-tracing correlation — see
 * `infrastructure/docker/nginx/nginx.conf`'s `json_combined` log format (`request_id`, sourced
 * from nginx's `$request_id`) and `infrastructure/docs/production-guide.md`'s "Logging" section,
 * which documents it explicitly as "nginx's built-in per-request correlation ID, echoed back to
 * the client as an X-Request-Id response header ... joined with backend request logs." No
 * `X-Correlation-Id` (or any other) header exists anywhere in this repository — reusing this name
 * for the client-generated ID extends that existing convention instead of adding a competing one.
 */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * M7: carries the same ID `correlationIdInterceptor` puts in the `X-Request-Id` header, readable
 * back off the (cloned) request by anything later in the interceptor chain — e.g. an observability
 * interceptor that wants to attach the ID a failed request actually used to a diagnostic log,
 * without generating a second ID or inspecting the response (which may have no headers at all on
 * a network failure). `HttpContext` survives `.clone()`, so this reads correctly no matter how many
 * interceptors between here and the backend clone the request further.
 */
export const CORRELATION_ID_CONTEXT = new HttpContextToken<string | null>(() => null);

/**
 * Generates a per-request identifier for the `X-Request-Id` header. Carries no user, account,
 * order, or device information, and is never persisted — it exists only for the lifetime of one
 * outgoing HTTP attempt (see `correlationIdInterceptor`'s doc comment for what "one attempt"
 * means across a silent-refresh retry).
 *
 * Prefers `crypto.randomUUID()` — cryptographically strong, native, zero-dependency. Falls back
 * to assembling a UUID v4 string from `crypto.getRandomValues()` (still the platform CSPRNG, just
 * without the convenience method) because this app's iOS deployment target is 15.0
 * (`IPHONEOS_DEPLOYMENT_TARGET` in `App.xcodeproj/project.pbxproj`), while `randomUUID()` itself
 * only shipped in WebKit/Safari 15.4 — relying on it alone would silently break correlation IDs
 * on iOS 15.0–15.3 WKWebViews. `getRandomValues()` has been available since iOS 11, so the
 * fallback covers the app's full supported range without adding a dependency solely for UUIDs.
 */
export function generateRequestId(): string {
  const cryptoObj = globalThis.crypto;

  if (typeof cryptoObj?.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  return uuidV4FromRandomValues(cryptoObj);
}

function uuidV4FromRandomValues(cryptoObj: Crypto): string {
  const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}
