import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@patheya-express-frontend/auth';

export const routes: Routes = [
  {
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-orders').then(
        (m) => m.RestaurantOrdersPageComponent,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-dashboard').then(
        (m) => m.RestaurantDashboardPageComponent,
      ),
  },
  {
    path: 'menu',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/menu-management').then(
        (m) => m.MenuManagementPageComponent,
      ),
  },
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    data: {
      brandName: 'Patheya Express for Restaurants',
      registerCta: { label: 'Apply as Restaurant Partner', path: '/partner/apply' },
    },
    loadComponent: () =>
      import('@patheya-express-frontend/auth-ui').then((m) => m.LoginPageComponent),
  },
  {
    path: 'partner/apply',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/partner-application/partner-application.page').then(
        (m) => m.PartnerApplicationPageComponent,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/restaurant-landing.page').then(
        (m) => m.RestaurantLandingPageComponent,
      ),
  },
];
