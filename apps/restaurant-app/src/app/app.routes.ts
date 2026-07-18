import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import { Routes, type CanActivateFn, type UrlTree } from '@angular/router';
import { authGuard, guestGuard } from '@patheya-express-frontend/auth';

type RestaurantOnboardingModule = typeof import('@patheya-express-frontend/restaurant-onboarding');

/**
 * restaurant-onboarding is lazy-loaded (see the loadComponent routes below), so its guards can't
 * be statically imported here without defeating that code-splitting — @nx/enforce-module-
 * boundaries rejects the build otherwise. `inject()` only works synchronously, so the
 * EnvironmentInjector is captured before the dynamic import and reapplied once the module (and
 * therefore the actual guard function) has loaded. Every guard in onboarding.guard.ts only ever
 * resolves to a boolean or a UrlTree, so that narrower result is asserted back onto the broader
 * CanActivateFn return type once awaited.
 */
function lazyOnboardingGuard(pick: (m: RestaurantOnboardingModule) => CanActivateFn): CanActivateFn {
  return async (route, state): Promise<boolean | UrlTree> => {
    const injector = inject(EnvironmentInjector);
    const m = await import('@patheya-express-frontend/restaurant-onboarding');
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
      import('@patheya-express-frontend/restaurant-onboarding').then(
        (m) => m.OnboardingWizardPageComponent,
      ),
  },
  {
    path: 'onboarding/waiting-approval',
    canActivate: [authGuard, onboardingWaitingApprovalGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-onboarding').then(
        (m) => m.WaitingApprovalPageComponent,
      ),
  },
  {
    path: 'onboarding/suspended',
    canActivate: [authGuard, onboardingSuspendedGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-onboarding').then(
        (m) => m.SuspendedPageComponent,
      ),
  },
  {
    path: 'orders',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-orders').then(
        (m) => m.RestaurantOrdersPageComponent,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-dashboard').then(
        (m) => m.RestaurantDashboardPageComponent,
      ),
  },
  {
    path: 'menu',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/menu-management').then(
        (m) => m.MenuManagementPageComponent,
      ),
  },
  {
    path: 'profile',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-profile').then(
        (m) => m.RestaurantProfilePageComponent,
      ),
  },
  {
    path: 'branches',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-branches').then(
        (m) => m.BranchListPageComponent,
      ),
  },
  {
    path: 'branches/:branchId',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-branches').then(
        (m) => m.BranchDetailPageComponent,
      ),
  },
  {
    path: 'staff',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-staff').then(
        (m) => m.StaffListPageComponent,
      ),
  },
  {
    path: 'holidays',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-holidays').then(
        (m) => m.HolidayCalendarPageComponent,
      ),
  },
  {
    path: 'gallery',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-gallery').then(
        (m) => m.GalleryPageComponent,
      ),
  },
  {
    path: 'notifications',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-notifications').then(
        (m) => m.NotificationCenterPageComponent,
      ),
  },
  {
    path: 'settings/business',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-settings').then(
        (m) => m.BusinessSettingsPageComponent,
      ),
  },
  {
    path: 'settings/operational',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('@patheya-express-frontend/restaurant-settings').then(
        (m) => m.OperationalSettingsPageComponent,
      ),
  },
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    data: {
      brandName: 'Patheya Express for Restaurants',
      registerCta: { label: 'Apply as Restaurant Partner', path: '/partner/apply' },
      homePath: '/dashboard',
    },
    loadComponent: () =>
      import('@patheya-express-frontend/auth-ui').then((m) => m.LoginPageComponent),
  },
  {
    path: 'partner/apply',
    canActivate: [guestGuard],
    data: { homePath: '/dashboard' },
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
