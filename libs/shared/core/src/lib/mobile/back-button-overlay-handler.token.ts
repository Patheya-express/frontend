import { InjectionToken } from '@angular/core';

/**
 * Lets the hardware back-button handler (`provideMobilePlatform()`, below in this same folder)
 * close an open modal/bottom-sheet/dialog instead of navigating the underlying route — without
 * `core` depending on `ui`'s overlay services directly. `core` is a non-buildable library and
 * `ui` is buildable; Nx's module-boundary rule forbids a buildable library depending on a
 * non-buildable one, and while the reverse direction isn't blocked by that specific rule, `core`
 * is meant to stay the foundational layer everything else (including `ui`) depends on, not the
 * other way round.
 *
 * Defaults to a no-op returning `false` ("nothing was closed, proceed with normal back
 * navigation") — a complete no-op for any app that never overrides it, same as every other piece
 * of `provideMobilePlatform()`'s behavior on web. The customer-facing app provides the real
 * implementation in its own `app.config.ts`, where depending on both `core` and `ui` is normal.
 */
export const BACK_BUTTON_OVERLAY_HANDLER = new InjectionToken<() => boolean>('BACK_BUTTON_OVERLAY_HANDLER', {
  factory: () => () => false,
});
