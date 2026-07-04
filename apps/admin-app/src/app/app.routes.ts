import { Routes } from '@angular/router';
import { guestGuard } from '@patheya-express-frontend/auth';

export const routes: Routes = [
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    data: { brandName: 'Patheya Express Admin', registerCta: null },
    loadComponent: () =>
      import('@patheya-express-frontend/auth-ui').then((m) => m.LoginPageComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/admin-landing.page').then((m) => m.AdminLandingPageComponent),
  },
];
