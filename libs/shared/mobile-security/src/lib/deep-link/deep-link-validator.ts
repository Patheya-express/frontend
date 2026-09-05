const ALLOWED_SCHEME = 'patheyaexpress';
const OFFERS_SUFFIX = 'offers';

// Matches both Mongo-style ObjectIds and UUIDs without depending on either format — the backend
// ID shape was not confirmed as part of this change, so this stays intentionally generic-but-safe
// (alphanumeric plus `-`/`_`, bounded length) rather than encoding an assumption about it. It
// excludes `.`, `/`, and `%`, which is what actually matters here: it can't match a path-traversal
// or extra-segment attempt.
const ID_SEGMENT_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

type RouteFamily =
  // `<root>` only.
  | 'bare'
  // `<root>` or `<root>/<id>`.
  | 'bare-or-id'
  // `<root>`, `<root>/<id>`, or `<root>/<id>/offers`.
  | 'bare-or-id-with-offers';

/**
 * The allow-listed root segments. `restaurants` is the original M1 public content link.
 * `notifications`/`orders`/`assignments` were added in M6 so a push-notification tap can navigate
 * safely — each maps to a route that already exists in at least one app's route table (customer-app
 * has `notifications`, `notifications/:id`, `orders`, `orders/:orderId`; restaurant-app has a
 * bare `orders` list only; delivery-app has a bare `assignments` list only), which is why
 * `assignments` is `'bare'` rather than `'bare-or-id'` — there is no per-assignment detail route to
 * validate an id segment against. These are ordinary in-app routes gated by the Router's own
 * `authGuard`, not auth-callback/payment-callback links carrying a token or signature that would
 * need its own verification — that distinct, still-unsupported category is unaffected by this list.
 */
const ROUTE_FAMILIES: Readonly<Record<string, RouteFamily>> = {
  restaurants: 'bare-or-id-with-offers',
  notifications: 'bare-or-id',
  orders: 'bare-or-id',
  assignments: 'bare',
};

export type DeepLinkRejectionReason =
  | 'malformed-url'
  | 'unsupported-scheme'
  | 'unexpected-authority'
  | 'unknown-route'
  | 'invalid-route-segment'
  | 'unexpected-query';

export type DeepLinkValidationResult =
  | { readonly allowed: true; readonly routerPath: string }
  | { readonly allowed: false; readonly reason: DeepLinkRejectionReason };

function reject(reason: DeepLinkRejectionReason): DeepLinkValidationResult {
  return { allowed: false, reason };
}

/**
 * Validates a `patheyaexpress://…` deep link before it is ever handed to the Angular Router.
 *
 * This is the security boundary for `mobile.providers.ts`'s `appUrlOpen` listener: the Android
 * intent-filter for this scheme (see `AndroidManifest.xml`) has no `android:host`/`pathPrefix`
 * restriction, so the OS will hand the app literally any `patheyaexpress://…` URI — from a
 * notification, a QR code, another installed app, or a malicious link. Nothing upstream of this
 * function filters that, so it has to be the thing that decides what is safe to navigate to.
 *
 * Custom URL schemes have no real authority component, so `new URL()` parses the first path
 * segment into `hostname` rather than `pathname` (this mirrors the parsing note that used to live
 * on `toRouterPath` in `mobile.providers.ts`, before that logic moved here). That quirk is exactly
 * what the route allow-list below checks against: `hostname` is treated as the top-level route
 * segment. Only the root segments in {@link ROUTE_FAMILIES} are allowed through, each shaped to
 * match a route that actually exists in the relevant app's route table. Everything else (unknown
 * schemes, unknown routes, extra path segments, query strings, userinfo/port authority tricks) is
 * rejected rather than forwarded to `router.navigateByUrl()`, so an external URL — or an untrusted
 * push-notification payload, per M6 — can never resolve to an arbitrary internal route.
 *
 * Intentionally scoped to content links only — this does not (and must not, until a real need and
 * a matching signature/token check exist) validate auth-callback or payment-callback deep links.
 */
export function validateDeepLink(rawUrl: string): DeepLinkValidationResult {
  if (!rawUrl) {
    return reject('malformed-url');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return reject('malformed-url');
  }

  if (parsed.protocol !== `${ALLOWED_SCHEME}:`) {
    return reject('unsupported-scheme');
  }

  // A custom scheme has no legitimate use for userinfo or an explicit port — either one present
  // means the URL is trying to smuggle something past a naive `hostname` comparison (e.g.
  // `patheyaexpress://restaurants@evil/x` or `patheyaexpress://restaurants:8080/x`).
  if (parsed.username || parsed.password || parsed.port) {
    return reject('unexpected-authority');
  }

  // Opaque (non-special-scheme) hosts are NOT lowercased by the URL parser the way domain hosts
  // are, so this comparison has to normalize case itself.
  const rootSegment = parsed.hostname.toLowerCase();
  const family = ROUTE_FAMILIES[rootSegment];
  if (!family) {
    return reject('unknown-route');
  }

  // No route in the allow-list below needs a query string today; treat any as unexpected rather
  // than silently ignoring it.
  if (parsed.search) {
    return reject('unexpected-query');
  }

  const segments = parsed.pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { allowed: true, routerPath: `/${rootSegment}` };
  }

  if (family === 'bare') {
    return reject('invalid-route-segment');
  }

  if (segments.length === 1 && ID_SEGMENT_PATTERN.test(segments[0])) {
    return {
      allowed: true,
      routerPath: `/${rootSegment}/${segments[0]}`,
    };
  }

  if (
    family === 'bare-or-id-with-offers' &&
    segments.length === 2 &&
    ID_SEGMENT_PATTERN.test(segments[0]) &&
    segments[1].toLowerCase() === OFFERS_SUFFIX
  ) {
    return {
      allowed: true,
      routerPath: `/${rootSegment}/${segments[0]}/${OFFERS_SUFFIX}`,
    };
  }

  return reject('invalid-route-segment');
}
