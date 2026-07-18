import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@patheya-express-frontend/auth';

export const routes: Routes = [
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
      import('@patheya-express-frontend/order-details').then((m) => m.OrderDetailsPageComponent),
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
      import('@patheya-express-frontend/customer-profile-ui').then((m) => m.ProfilePageComponent),
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
      import('@patheya-express-frontend/customer-offers').then((m) => m.OfferListPageComponent),
  },
  {
    path: 'offers/:id',
    loadComponent: () =>
      import('@patheya-express-frontend/customer-offers').then((m) => m.OfferDetailPageComponent),
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
      import('@patheya-express-frontend/customer-support').then((m) => m.CreateTicketPageComponent),
  },
  {
    path: 'support/tickets/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/customer-support').then((m) => m.TicketDetailPageComponent),
  },
  {
    path: 'support/tickets',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/customer-support').then((m) => m.TicketListPageComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('@patheya-express-frontend/customer-home').then((m) => m.CustomerHomePageComponent),
  },
];
