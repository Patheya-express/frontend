export const uiLibraryMarker = 'ui-library';

export * from './lib/app-shell/app-shell.component';
export * from './lib/footer/footer.component';
export * from './lib/header/header.component';
export * from './lib/skeleton/skeleton.component';
export * from './lib/empty-state/empty-state.component';
export * from './lib/error-state/error-state.component';
export * from './lib/auth-layout/auth-layout.component';
export * from './lib/auth-card/auth-card.component';
export * from './lib/login-form/login-form.component';
export * from './lib/register-form/register-form.component';
export * from './lib/forgot-password-form/forgot-password-form.component';
export * from './lib/reset-password-form/reset-password-form.component';
export * from './lib/hero-section/hero-section.component';
export * from './lib/feature-card/feature-card.component';
export * from './lib/cta-section/cta-section.component';
export * from './lib/cart-badge/cart-badge.component';
export * from './lib/notification-badge/notification-badge.component';
export * from './lib/order-status-badge/order-status-badge.component';
export * from './lib/confirm-dialog/confirm-dialog.component';
export * from './lib/metric-card/metric-card.component';
export * from './lib/partner-shell/partner-shell.component';
export * from './lib/status-chip/status-chip.component';
export * from './lib/search-input/search-input.component';
export * from './lib/pagination/pagination.component';
export * from './lib/table-toolbar/table-toolbar.component';
export * from './lib/data-table/data-table.component';
export * from './lib/star-rating/star-rating.component';
export * from './lib/file-upload/file-upload.component';
export * from './lib/restaurant-branch-switcher/restaurant-branch-switcher.component';
export * from './lib/search-bar/search-bar.component';
export * from './lib/carousel/carousel.component';
export * from './lib/horizontal-shelf/horizontal-shelf.component';

// Tokens (TS mirrors of theme.scss's new custom properties — see theme.scss for the CSS side)
export * from './lib/tokens/z-index.tokens';
export * from './lib/tokens/motion.tokens';
export * from './lib/tokens/touch-target.tokens';

// Types
export * from './lib/types/common.types';
export * from './lib/types/overlay.types';

// Utils
export * from './lib/utils/track-by.utils';
export * from './lib/utils/highlight.utils';
export * from './lib/utils/currency.utils';

// Animations
export * from './lib/animations/reduced-motion.util';
export * from './lib/animations/page-transition.animation';
export * from './lib/animations/modal.animation';
export * from './lib/animations/bottom-sheet.animation';
export * from './lib/animations/list.animation';
export * from './lib/animations/toast.animation';

// Services (overlay/notification stacks + mobile navigation coordination — platform detection
// services (MobilePlatformService/NetworkStatusService/BreakpointService) live in
// @patheya-express-frontend/core instead, see that library)
export * from './lib/services/overlay-stack.service';
export * from './lib/services/modal.service';
export * from './lib/services/bottom-sheet.service';
export * from './lib/services/dialog.service';
export * from './lib/services/toast.service';
export * from './lib/services/mobile-navigation.service';
export * from './lib/services/network-status.service';

// Directives
export * from './lib/directives/auto-focus.directive';
export * from './lib/directives/ripple.directive';
export * from './lib/directives/long-press.directive';
export * from './lib/directives/swipe.directive';
export * from './lib/directives/infinite-scroll.directive';
export * from './lib/directives/pull-to-refresh.directive';
export * from './lib/directives/lazy-image.directive';
export * from './lib/directives/list-stagger.directive';

// Pipes
export * from './lib/pipes/truncate.pipe';
export * from './lib/pipes/time-ago.pipe';
export * from './lib/pipes/currency-format.pipe';

// Buttons
export * from './lib/buttons/button-base';
export * from './lib/buttons/primary-button.component';
export * from './lib/buttons/secondary-button.component';
export * from './lib/buttons/icon-button.component';
export * from './lib/components/link-button/link-button.component';

// Feedback
export * from './lib/badge/badge.component';
export * from './lib/divider/divider.component';
export * from './lib/loading-overlay/loading-overlay.component';
export * from './lib/progress-indicator/progress-indicator.component';

// Notifications & overlays
export * from './lib/toast/toast.component';
export * from './lib/snackbar/snackbar.component';
export * from './lib/bottom-sheet/bottom-sheet.component';
export * from './lib/overlays/modal-host/modal-host.component';
export * from './lib/overlays/bottom-sheet-host/bottom-sheet-host.component';
export * from './lib/overlays/dialog-host/dialog-host.component';
export * from './lib/overlays/toast-host/toast-host.component';
export * from './lib/overlays/confirm-dialog-overlay/confirm-dialog-overlay.component';

// Status
export * from './lib/offline-banner/offline-banner.component';
export * from './lib/network-status/network-status.component';

// Lists
export * from './lib/list-tile/list-tile.component';

// Mobile-native shell layout — see layouts/desktop and layouts/tablet READMEs for why nothing
// physically lives in those two folders
export * from './lib/layouts/mobile/mobile-shell/mobile-shell.component';
export * from './lib/layouts/mobile/safe-area-layout/safe-area-layout.component';
export * from './lib/layouts/mobile/page-container/page-container.component';
export * from './lib/layouts/mobile/scrollable-page/scrollable-page.component';
export * from './lib/layouts/mobile/section/section.component';
export * from './lib/layouts/mobile/bottom-action-bar/bottom-action-bar.component';
export * from './lib/layouts/mobile/top-app-bar/top-app-bar.component';
export * from './lib/layouts/mobile/bottom-tabs/bottom-tabs.component';
