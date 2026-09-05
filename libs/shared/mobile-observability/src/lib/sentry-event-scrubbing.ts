import type { Breadcrumb, Event } from '@sentry/capacitor';
import { scrubSensitiveData } from './sensitive-data';

/**
 * `beforeSend` — the last stop before an event leaves the device. Client-side prevention (never
 * passing sensitive fields into logger/error metadata in the first place) is the primary defense;
 * this is the provider-side backstop M7.19 asks for. Scrubs `request` (headers/cookies included —
 * an `Authorization`/`Cookie` key nested inside is caught by the same key-matching
 * `scrubSensitiveData` applies everywhere else), `extra`, `contexts`, and `user`, then reduces
 * `user` to its `id` only even if something upstream ever attached more.
 */
// Generic over the exact event subtype (Sentry's `beforeSend` is typed to the narrower
// `ErrorEvent`, not the broader `Event` union that also covers transaction events) so the
// returned value stays assignable back to whatever specific type the caller passed in.
export function scrubSentryEvent<T extends Event>(event: T): T {
  const scrubbed: T = {
    ...event,
    request: event.request ? scrubSensitiveData(event.request) : event.request,
    extra: event.extra ? scrubSensitiveData(event.extra) : event.extra,
    contexts: event.contexts ? scrubSensitiveData(event.contexts) : event.contexts,
  };

  if (event.user) {
    scrubbed.user = event.user.id ? { id: event.user.id } : undefined;
  }

  return scrubbed;
}

/** Same idea as {@link scrubSentryEvent}, applied to breadcrumb `data` (the only free-form part of
 *  a breadcrumb) before it's attached to whatever event eventually gets sent. */
export function scrubSentryBreadcrumb<T extends Breadcrumb>(breadcrumb: T): T {
  if (!breadcrumb.data) {
    return breadcrumb;
  }
  return { ...breadcrumb, data: scrubSensitiveData(breadcrumb.data) };
}
