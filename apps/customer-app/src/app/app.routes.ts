import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import { Routes, type CanActivateChildFn, type UrlTree } from '@angular/router';
import { authGuard, guestGuard } from '@patheya-express-frontend/auth';

type AuthUiModule = typeof import('@patheya-express-frontend/auth-ui');

/**
 * auth-ui is lazy-loaded (see the loadComponent routes below), so splashGuard can't be statically
 * imported here without defeating that code-splitting — a static top-level import would pull its
 * whole module into the main bundle instead. `inject()` only works synchronously, so the
 * EnvironmentInjector is captured before the dynamic import and reapplied (via
 * `runInInjectionContext`) once the module — and therefore the actual guard function — has
 * loaded; calling `m.splashGuard(...)` directly inside the dynamic import's `.then()` (the
 * previous implementation) ran it after Angular's own `runInInjectionContext` wrapper around this
 * function had already returned and torn down its injection context, causing
 * `inject(AppBootstrapStateService)` inside splashGuard to throw NG0203. Exact mirror of
 * restaurant-app's/delivery-app's `lazyOnboardingGuard()`.
 */
function lazySplashGuard(pick: (m: AuthUiModule) => CanActivateChildFn): CanActivateChildFn {
  return async (childRoute, state): Promise<boolean | UrlTree> => {
    const injector = inject(EnvironmentInjector);
    const m = await import('@patheya-express-frontend/auth-ui');
    const result = await runInInjectionContext(injector, () => pick(m)(childRoute, state));
    return result as boolean | UrlTree;
  };
}

const splashGuard = lazySplashGuard((m) => m.splashGuard);

export const routes: Routes = [
  {
    path: 'splash',
    data: {
      brandName: 'Patheya Express',
      quotes: [
        'Every meal tells a story.',
        'Delivering happiness, one order at a time.',
        'Fresh food, fast delivery.',
        'Great food deserves great delivery.',
      ],
    },
    loadComponent: () =>
      import('@patheya-express-frontend/auth-ui').then((m) => m.SplashPageComponent),
  },
  {
    path: 'welcome',
    data: {
      brandName: 'Patheya Express',
      tagline: 'Great food, delivered fast — right to your door.',
    },
    loadComponent: () =>
      import('@patheya-express-frontend/auth-ui').then((m) => m.WelcomePageComponent),
  },
  {
    // Every existing route, unchanged, gated behind the one-time-per-session splash redirect
    // (see `splashGuard` above, and `lazySplashGuard`'s doc comment for why it's wrapped) —
    // `path: ''` + `canActivateChild` wraps them without altering any individual route's own
    // path, `canActivate`, or `data`.
    path: '',
    canActivateChild: [splashGuard],
    children: [
      {
        path: 'auth/login',
        canActivate: [guestGuard],
        data: {
          brandName: 'Patheya Express',
          registerCta: { label: 'Sign up', path: '/auth/register' },
        },
        loadComponent: () =>
          import('@patheya-express-frontend/auth-ui').then((m) => m.LoginPageComponent),
      },
      {
        path: 'auth/register',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('@patheya-express-frontend/auth-ui').then((m) => m.RegisterPageComponent),
      },
      {
        path: 'auth/forgot-password',
        canActivate: [guestGuard],
        data: {
          brandName: 'Patheya Express',
        },
        loadComponent: () =>
          import('@patheya-express-frontend/auth-ui').then((m) => m.ForgotPasswordPageComponent),
      },
      {
        path: 'auth/reset-password',
        canActivate: [guestGuard],
        data: {
          brandName: 'Patheya Express',
        },
        loadComponent: () =>
          import('@patheya-express-frontend/auth-ui').then((m) => m.ResetPasswordPageComponent),
      },
      {
        path: 'restaurants/:restaurantId/offers',
        loadComponent: () =>
          import('@patheya-express-frontend/customer-offers').then(
            (m) => m.RestaurantOffersPageComponent,
          ),
      },
      {
        path: 'restaurants/:restaurantId',
        loadComponent: () =>
          import('@patheya-express-frontend/restaurant-menu').then(
            (m) => m.RestaurantDetailsPageComponent,
          ),
      },
      {
        path: 'cart',
        loadComponent: () =>
          import('@patheya-express-frontend/cart-ui').then((m) => m.CartPageComponent),
      },
      {
        path: 'checkout',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@patheya-express-frontend/checkout').then((m) => m.CheckoutPageComponent),
      },
      {
        path: 'orders',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@patheya-express-frontend/order-details').then((m) => m.OrderListPageComponent),
      },
      {
        path: 'orders/:orderId',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@patheya-express-frontend/order-details').then(
            (m) => m.OrderDetailsPageComponent,
          ),
      },
      {
        path: 'restaurants',
        loadComponent: () =>
          import('@patheya-express-frontend/restaurant-discovery').then(
            (m) => m.RestaurantListComponent,
          ),
      },
      {
        path: 'account',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@patheya-express-frontend/customer-profile-ui').then(
            (m) => m.ProfilePageComponent,
          ),
      },
      {
        path: 'account/settings',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@patheya-express-frontend/customer-profile-ui').then(
            (m) => m.AccountSettingsPageComponent,
          ),
      },
      {
        path: 'favorites',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@patheya-express-frontend/favorites').then((m) => m.FavoritesPageComponent),
      },
      {
        path: 'notifications',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@patheya-express-frontend/customer-notifications-ui').then(
            (m) => m.NotificationListPageComponent,
          ),
      },
      {
        path: 'notifications/:id',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@patheya-express-frontend/customer-notifications-ui').then(
            (m) => m.NotificationDetailPageComponent,
          ),
      },
      {
        path: 'offers',
        loadComponent: () =>
          import('@patheya-express-frontend/customer-offers').then(
            (m) => m.OfferListPageComponent,
          ),
      },
      {
        path: 'offers/:id',
        loadComponent: () =>
          import('@patheya-express-frontend/customer-offers').then(
            (m) => m.OfferDetailPageComponent,
          ),
      },
      {
        path: 'wallet',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@patheya-express-frontend/customer-wallet').then((m) => m.WalletPageComponent),
      },
      {
        path: 'wallet/refer',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@patheya-express-frontend/customer-wallet').then((m) => m.ReferralPageComponent),
      },
      {
        path: 'support/faqs',
        loadComponent: () =>
          import('@patheya-express-frontend/customer-support').then((m) => m.FaqPageComponent),
      },
      {
        path: 'support/tickets/new',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@patheya-express-frontend/customer-support').then(
            (m) => m.CreateTicketPageComponent,
          ),
      },
      {
        path: 'support/tickets/:id',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@patheya-express-frontend/customer-support').then(
            (m) => m.TicketDetailPageComponent,
          ),
      },
      {
        path: 'support/tickets',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@patheya-express-frontend/customer-support').then(
            (m) => m.TicketListPageComponent,
          ),
      },
      {
        path: '',
        loadComponent: () =>
          import('@patheya-express-frontend/customer-home').then(
            (m) => m.CustomerHomePageComponent,
          ),
      },
    ],
  },
];
