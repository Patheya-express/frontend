/**
 * TypeScript mirror of the `--z-index-*` custom properties in `mobile-tokens.scss`. Components
 * that need a numeric z-index in TS (rather than a CSS class) — e.g. computing overlay stacking
 * order for nested bottom sheets — read from here instead of hardcoding a number, so the two
 * scales can never drift apart.
 */
export const MOBILE_Z_INDEX = {
  base: 0,
  sticky: 10,
  bottomTabs: 20,
  topAppBar: 20,
  fab: 30,
  overlayBackdrop: 1000,
  bottomSheet: 1010,
  modal: 1020,
  dialog: 1030,
  toast: 1040,
} as const;

export type MobileZIndexLayer = keyof typeof MOBILE_Z_INDEX;
