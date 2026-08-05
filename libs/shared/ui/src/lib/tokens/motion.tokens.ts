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
  slower: 500,
} as const;

export const MOBILE_MOTION_EASINGS = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  /** Slight overshoot (spring-like settle) — see theme.scss's --motion-easing-soft for where
   *  this is intentionally used vs. the three "clinical" easings above. */
  soft: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const MOBILE_MOTION_STAGGER_STEP_MS = 30;

export type MobileMotionDuration = keyof typeof MOBILE_MOTION_DURATIONS_MS;
export type MobileMotionEasing = keyof typeof MOBILE_MOTION_EASINGS;

/**
 * Named animation tokens → the `mobile-anim-*` utility class each applies (see
 * `animations/keyframes.scss` for the keyframes themselves). Lets a component apply
 * `[class]="MOTION.pop"` instead of a hand-typed class string, so a class name is never
 * duplicated between a `.ts` file and the stylesheet that defines it. `shimmer` points at
 * `skeleton.component.scss`'s existing shimmer class rather than a new one — that effect already
 * exists and shouldn't be reimplemented here.
 */
export const MOTION_TOKENS = {
  fade: 'mobile-anim-fade',
  'slide-up': 'mobile-anim-slide-up',
  'slide-down': 'mobile-anim-slide-down',
  'slide-left': 'mobile-anim-slide-left',
  'slide-right': 'mobile-anim-slide-right',
  scale: 'mobile-anim-scale-in',
  pop: 'mobile-anim-pop',
  'bounce-small': 'mobile-anim-bounce-small',
  pulse: 'mobile-anim-pulse',
  float: 'mobile-anim-float',
  shimmer: 'skeleton-shimmer',
  glow: 'mobile-anim-glow',
  shake: 'mobile-anim-shake',
} as const;

export type MotionToken = keyof typeof MOTION_TOKENS;
