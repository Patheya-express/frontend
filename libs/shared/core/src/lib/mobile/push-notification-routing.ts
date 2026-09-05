import { validateDeepLink } from '@patheya-express-frontend/mobile-security';

export interface PushTapRouteOptions {
  /** One of the root segments `validateDeepLink` allow-lists (e.g. `'notifications'`, `'orders'`,
   *  `'assignments'`) — always a hardcoded literal supplied by the calling app, never derived from
   *  the untrusted notification payload. */
  readonly rootSegment: string;
  /** Field to read an optional id from within the tapped notification's `data` payload, if this
   *  app's route for `rootSegment` has an id-based detail route. Omit for a bare-list-only route. */
  readonly idField?: string;
}

/**
 * Resolves where a tapped push notification should navigate to, reusing the M1 mobile-security
 * deep-link validator rather than handing `router.navigateByUrl()` unvalidated payload data
 * directly (see `validateDeepLink`'s doc comment for the allow-list this enforces). `data` is
 * whatever the backend put in the notification payload — entirely untrusted.
 *
 * If `idField` names a value that isn't a safe id (missing, wrong type, or fails the validator's
 * id pattern), this falls back to the bare `rootSegment` route rather than refusing to navigate
 * outright — the bare list is itself an allow-listed, safe destination that doesn't depend on any
 * part of the untrusted payload, so a malformed id degrades the destination instead of losing the
 * "wake user attention" behavior entirely.
 *
 * Returns null only if `rootSegment` itself isn't allow-listed — which shouldn't happen for a
 * literal this module controls, but is checked rather than assumed.
 */
export function resolvePushTapRoute(data: unknown, options: PushTapRouteOptions): string | null {
  const id = options.idField ? (data as Record<string, unknown> | null)?.[options.idField] : undefined;
  const idPath = typeof id === 'string' && id.length > 0 ? `${options.rootSegment}/${id}` : null;

  if (idPath) {
    const result = validateDeepLink(`patheyaexpress://${idPath}`);
    if (result.allowed) {
      return result.routerPath;
    }
  }

  const bareResult = validateDeepLink(`patheyaexpress://${options.rootSegment}`);
  return bareResult.allowed ? bareResult.routerPath : null;
}
