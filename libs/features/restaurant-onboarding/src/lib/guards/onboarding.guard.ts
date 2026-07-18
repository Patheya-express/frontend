import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import type { OnboardingResponseDto, RestaurantResponseDto } from '@patheya-express-frontend/api-sdk';
import { OnboardingWizardFeatureService } from '../services/onboarding-wizard.service';

/**
 * The single source of truth for where an authenticated restaurant owner belongs, given their
 * onboarding progress and the restaurant's operational status. A restaurant only ever becomes
 * reachable (dashboard/orders/menu/etc.) once onboarding is APPROVED — see OnboardingModule on
 * the backend, which is the only place that flips Restaurant.status in response to onboarding.
 */
function resolveDestination(onboarding: OnboardingResponseDto, restaurant: RestaurantResponseDto): string {
  if (restaurant.status === 'SUSPENDED') {
    return '/onboarding/suspended';
  }

  if (onboarding.status === 'APPROVED') {
    return '/dashboard';
  }

  if (onboarding.status === 'SUBMITTED' || onboarding.status === 'UNDER_REVIEW' || onboarding.status === 'REJECTED') {
    return '/onboarding/waiting-approval';
  }

  return '/onboarding';
}

async function loadDestination(service: OnboardingWizardFeatureService): Promise<string> {
  try {
    const [onboarding, restaurant] = await Promise.all([service.getState(), service.getRestaurant()]);
    return resolveDestination(onboarding, restaurant);
  } catch {
    return '/onboarding';
  }
}

function redirectUnless(expected: string): CanActivateFn {
  return async () => {
    const service = inject(OnboardingWizardFeatureService);
    const router = inject(Router);

    const destination = await loadDestination(service);

    return destination === expected ? true : router.createUrlTree([destination]);
  };
}

/** Blocks Dashboard/Orders/Menu/Branches/Staff/Holidays/Gallery/Notifications/Settings/Profile
 *  until onboarding is fully approved. */
export const onboardingGuard: CanActivateFn = redirectUnless('/dashboard');

/** Sends an owner who is already past the wizard stage away from `/onboarding` itself. */
export const onboardingEntryGuard: CanActivateFn = redirectUnless('/onboarding');

/** Only reachable once the application has actually been submitted. */
export const onboardingWaitingApprovalGuard: CanActivateFn = redirectUnless('/onboarding/waiting-approval');

/** Only reachable while the restaurant is suspended. */
export const onboardingSuspendedGuard: CanActivateFn = redirectUnless('/onboarding/suspended');
