import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import { Routes, type CanActivateFn, type UrlTree } from '@angular/router';
import { authGuard, guestGuard } from '@patheya-express-frontend/auth';

type DeliveryOnboardingModule = typeof import('@patheya-express-frontend/delivery-onboarding');

/**
 * delivery-onboarding is lazy-loaded (see the loadComponent routes below), so its guards can't be
 * statically imported here without defeating that code-splitting — @nx/enforce-module-boundaries
 * rejects the build otherwise. Exact mirror of restaurant-app's lazyOnboardingGuard().
 */
function lazyOnboardingGuard(pick: (m: DeliveryOnboardingModule) => CanActivateFn): CanActivateFn {
  return async (route, state): Promise<boolean | UrlTree> => {
    const injector = inject(EnvironmentInjector);
    const m = await import('@patheya-express-frontend/delivery-onboarding');
    const result = await runInInjectionContext(injector, () => pick(m)(route, state));
    return result as boolean | UrlTree;
  };
}

const onboardingGuard = lazyOnboardingGuard((m) => m.onboardingGuard);
const onboardingEntryGuard = lazyOnboardingGuard((m) => m.onboardingEntryGuard);
const onboardingWaitingApprovalGuard = lazyOnboardingGuard((m) => m.onboardingWaitingApprovalGuard);
const onboardingSuspendedGuard = lazyOnboardingGuard((m) => m.onboardingSuspendedGuard);

export const routes: Routes = [
  {
    path: 'onboarding',
    canActivate: [authGuard, onboardingEntryGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-onboarding').then((m) => m.OnboardingWizardPageComponent),
  },
  {
    path: 'onboarding/waiting-approval',
    canActivate: [authGuard, onboardingWaitingApprovalGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-onboarding').then((m) => m.WaitingApprovalPageComponent),
  },
  {
    path: 'onboarding/suspended',
    canActivate: [authGuard, onboardingSuspendedGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-onboarding').then((m) => m.SuspendedPageComponent),
  },
  {
    path: 'verification',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-verification').then((m) => m.VerificationPageComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-dashboard').then((m) => m.DeliveryDashboardPageComponent),
  },
  {
    path: 'assignments',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-assignments').then((m) => m.DeliveryAssignmentsPageComponent),
  },
  {
    path: 'fees',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-fees').then((m) => m.DeliveryFeesPageComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-profile').then((m) => m.ProfilePageComponent),
  },
  {
    path: 'profile/vehicles',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-vehicles').then((m) => m.VehiclesPageComponent),
  },
  {
    path: 'profile/documents',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-documents').then((m) => m.DocumentsPageComponent),
  },
  {
    path: 'profile/bank',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-bank').then((m) => m.BankAccountPageComponent),
  },
  {
    path: 'profile/compliance',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/delivery-compliance').then((m) => m.CompliancePageComponent),
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
