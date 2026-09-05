/**
 * Default ceiling for a JSON API request on a mobile network. No existing timeout convention was
 * found anywhere in the repository (checked environment files, `ApiConfiguration`, and the
 * generated SDK) — this is a new, centralized constant rather than a value scattered per call
 * site. 20s balances "don't hang indefinitely" against real-world cellular latency; it is not
 * tuned per endpoint.
 */
export const DEFAULT_HTTP_TIMEOUT_MS = 20_000;

/**
 * Longer ceiling applied only to requests whose body is `FormData` — this repo's generated SDK
 * builds a real `FormData` body for every multipart upload endpoint (photo/document/logo/banner/
 * avatar/attachment uploads — see `RequestBuilder`'s `multipart/form-data` handling), and those
 * legitimately need more time on a slow mobile upload than a small JSON payload does. Detecting
 * this from the request shape itself (`req.body instanceof FormData`) keeps the exception
 * centralized in `httpTimeoutInterceptor` instead of requiring every upload call site to pass a
 * per-request override.
 */
export const UPLOAD_HTTP_TIMEOUT_MS = 60_000;
