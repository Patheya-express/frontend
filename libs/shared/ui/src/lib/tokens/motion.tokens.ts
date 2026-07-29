/**
 * TypeScript mirror of the `--motion-duration-*` / `--motion-easing-*` custom properties in
 * `mobile-tokens.scss`. Kept in sync manually (there are only 4 durations + 3 easings) — read
 * from here wherever a directive/service needs a numeric `ms` value (e.g. a `setTimeout` fallback
 * for an `animationend` listener), instead of a second hardcoded number.
 */
export const MOBILE_MOTION_DURATIONS_MS = {
  instant: 100,
  fast: 180,
  base: 260,
  slow: 360,
} as const;

export const MOBILE_MOTION_EASINGS = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
} as const;

export const MOBILE_MOTION_STAGGER_STEP_MS = 30;

export type MobileMotionDuration = keyof typeof MOBILE_MOTION_DURATIONS_MS;
export type MobileMotionEasing = keyof typeof MOBILE_MOTION_EASINGS;
