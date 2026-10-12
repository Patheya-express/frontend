import {
  EnvironmentInjector,
  inject,
  runInInjectionContext,
} from '@angular/core';
import { Routes, type CanActivateFn, type UrlTree } from '@angular/router';
import { authGuard, guestGuard } from '@patheya-express-frontend/auth';
import { DELIVERY_PARTNER_BRAND_NAME } from './brand';
import { deliveryPartnerGuard } from './delivery-partner.guard';

type DeliveryOnboardingModule =
  typeof import('@patheya-express-frontend/delivery-onboarding');

/**
 * delivery-onboarding is lazy-loaded (see the loadComponent routes below), so its guards can't be
 * statically imported here without defeating that code-splitting — @nx/enforce-module-boundaries
 * rejects the build otherwise. Exact mirror of restaurant-app's lazyOnboardingGuard().
 */
function lazyOnboardingGuard(
  pick: (m: DeliveryOnboardingModule) => CanActivateFn,
): CanActivateFn {
  return async (route, state): Promise<boolean | UrlTree> => {
    const injector = inject(EnvironmentInjector);
    const m = await import('@patheya-express-frontend/delivery-onboarding');
    const result = await runInInjectionContext(injector, () =>
      pick(m)(route, state),
    );
    return result as boolean | UrlTree;
  };
}

const onboardingGuard = lazyOnboardingGuard((m) => m.onboardingGuard);
const onboardingEntryGuard = lazyOnboardingGuard((m) => m.onboardingEntryGuard);
const onboardingWaitingApprovalGuard = lazyOnboardingGuard(
  (m) => m.onboardingWaitingApprovalGuard,
);
const onboardingSuspendedGuard = lazyOnboardingGuard(
  (m) => m.onboardingSuspendedGuard,
);

export const routes: Routes = [
  {
    path: 'onboarding',
    canActivate: [authGuard, deliveryPartnerGuard, onboardingEntryGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-onboarding').then(
        (m) => m.OnboardingWizardPageComponent,
      ),
  },
  {
    path: 'onboarding/waiting-approval',
    canActivate: [
      authGuard,
      deliveryPartnerGuard,
      onboardingWaitingApprovalGuard,
    ],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-onboarding').then(
        (m) => m.WaitingApprovalPageComponent,
      ),
  },
  {
    path: 'onboarding/suspended',
    canActivate: [authGuard, deliveryPartnerGuard, onboardingSuspendedGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-onboarding').then(
        (m) => m.SuspendedPageComponent,
      ),
  },
  {
    path: 'verification',
    canActivate: [authGuard, deliveryPartnerGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-verification').then(
        (m) => m.VerificationPageComponent,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard, deliveryPartnerGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-dashboard').then(
        (m) => m.DeliveryDashboardPageComponent,
      ),
  },
  {
    path: 'assignments',
    canActivate: [authGuard, deliveryPartnerGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-assignments').then(
        (m) => m.DeliveryAssignmentsPageComponent,
      ),
  },
  {
    path: 'fees',
    canActivate: [authGuard, deliveryPartnerGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-fees').then(
        (m) => m.DeliveryFeesPageComponent,
      ),
  },
  {
    path: 'profile',
    canActivate: [authGuard, deliveryPartnerGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-profile').then(
        (m) => m.ProfilePageComponent,
      ),
  },
  {
    path: 'profile/vehicles',
    canActivate: [authGuard, deliveryPartnerGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-vehicles').then(
        (m) => m.VehiclesPageComponent,
      ),
  },
  {
    path: 'profile/documents',
    canActivate: [authGuard, deliveryPartnerGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-documents').then(
        (m) => m.DocumentsPageComponent,
      ),
  },
  {
    path: 'profile/bank',
    canActivate: [authGuard, deliveryPartnerGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-bank').then(
        (m) => m.BankAccountPageComponent,
      ),
  },
  {
    path: 'profile/compliance',
    canActivate: [authGuard, deliveryPartnerGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-compliance').then(
        (m) => m.CompliancePageComponent,
      ),
  },
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    data: {
      brandName: DELIVERY_PARTNER_BRAND_NAME,
      registerCta: {
        label: 'Join as a delivery partner',
        path: '/partner/join',
      },
      homePath: '/dashboard',
    },
    loadComponent: () =>
      import('@patheya-express-frontend/auth-ui').then(
        (m) => m.LoginPageComponent,
      ),
  },
  {
    path: 'auth/forgot-password',
    canActivate: [guestGuard],
    data: { brandName: DELIVERY_PARTNER_BRAND_NAME, homePath: '/dashboard' },
    loadComponent: () =>
      import('@patheya-express-frontend/auth-ui').then(
        (m) => m.ForgotPasswordPageComponent,
      ),
  },
  {
    path: 'auth/reset-password',
    canActivate: [guestGuard],
    data: { brandName: DELIVERY_PARTNER_BRAND_NAME, homePath: '/dashboard' },
    loadComponent: () =>
      import('@patheya-express-frontend/auth-ui').then(
        (m) => m.ResetPasswordPageComponent,
      ),
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
  // Login-first: the app opens on login. guestGuard forwards an already-authenticated partner
  // (a restored, still-valid session) straight to /dashboard, where authGuard/onboardingGuard
  // take over. Previously '' rendered a marketing landing page.
  { path: '', pathMatch: 'full', redirectTo: 'auth/login' },
  // Unknown URLs previously threw NG04002 (no route matched) and left a blank screen.
  { path: '**', redirectTo: 'auth/login' },
];
