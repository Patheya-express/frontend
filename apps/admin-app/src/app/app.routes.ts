import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from '@patheya-express-frontend/auth';

export const routes: Routes = [
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    data: { brandName: 'Patheya Express Admin', registerCta: null, homePath: '/dashboard' },
    loadComponent: () =>
      import('@patheya-express-frontend/auth-ui').then((m) => m.LoginPageComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/admin-dashboard').then((m) => m.AdminDashboardPageComponent),
  },
  {
    path: 'users',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/admin-users').then((m) => m.AdminUsersPageComponent),
  },
  {
    path: 'restaurants',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/admin-restaurants').then((m) => m.AdminRestaurantsPageComponent),
  },
  {
    path: 'restaurants/verification',
    canActivate: [authGuard, roleGuard(['ADMIN', 'SUPER_ADMIN'])],
    loadComponent: () =>
      import('@patheya-express-frontend/admin-restaurant-verification').then(
        (m) => m.AdminRestaurantVerificationPageComponent,
      ),
  },
  {
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/admin-orders').then((m) => m.AdminOrdersPageComponent),
  },
  {
    path: 'delivery',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/admin-delivery').then((m) => m.AdminDeliveryPageComponent),
  },
  {
    path: 'delivery/verification',
    canActivate: [authGuard, roleGuard(['ADMIN', 'SUPER_ADMIN'])],
    loadComponent: () =>
      import('@patheya-express-frontend/admin-delivery-verification').then(
        (m) => m.AdminDeliveryVerificationPageComponent,
      ),
  },
  {
    path: 'payments',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/admin-payments').then((m) => m.AdminPaymentsPageComponent),
  },
  {
    path: 'audit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/admin-audit').then((m) => m.AdminAuditPageComponent),
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/admin-notifications').then((m) => m.AdminNotificationsPageComponent),
  },
  {
    path: 'support',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/admin-support').then((m) => m.AdminSupportPageComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/admin-landing.page').then((m) => m.AdminLandingPageComponent),
  },
];
