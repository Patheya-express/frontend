/**
 * TypeScript mirror of the `--touch-target-*` custom properties in `mobile-tokens.scss`. Used by
 * directives that need a numeric pixel value (e.g. `RippleDirective` sizing itself relative to
 * its host, `LongPressDirective`/`SwipeDirective` computing a minimum drag/hold hitbox).
 */
export const MOBILE_TOUCH_TARGET_PX = {
  min: 44,
  comfortable: 48,
  large: 56,
} as const;
