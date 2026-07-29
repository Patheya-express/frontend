/** Class names for `keyframes.scss`'s page-transition animation — applied by whatever hosts
 *  page-level routing transitions (left to the consuming app's route-level wrapper;
 *  `@patheya-express-frontend/ui` ships the animation, not a router-transition hook, since that
 *  depends on each app's own `RouterOutlet` usage). */
export const MOBILE_PAGE_TRANSITION = {
  enter: 'mobile-anim-page-enter',
  leave: 'mobile-anim-page-leave',
} as const;
