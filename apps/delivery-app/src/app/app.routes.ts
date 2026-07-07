import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@patheya-express-frontend/auth';

export const routes: Routes = [
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-dashboard').then(
        (m) => m.DeliveryDashboardPageComponent,
      ),
  },
  {
    path: 'assignments',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-assignments').then(
        (m) => m.DeliveryAssignmentsPageComponent,
      ),
  },
  {
    path: 'fees',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-fees').then(
        (m) => m.DeliveryFeesPageComponent,
      ),
  },
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    data: {
      brandName: 'Patheya Express Courier',
      registerCta: { label: 'Join as Delivery Partner', path: '/partner/join' },
      homePath: '/dashboard',
    },
    loadComponent: () =>
      import('@patheya-express-frontend/auth-ui').then((m) => m.LoginPageComponent),
  },
  {
    path: 'partner/join',
    canActivate: [guestGuard],
    data: { homePath: '/dashboard' },
    loadComponent: () =>
      import('./pages/partner-onboarding/partner-onboarding.page').then(
        (m) => m.PartnerOnboardingPageComponent,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/delivery-landing.page').then((m) => m.DeliveryLandingPageComponent),
  },
];
