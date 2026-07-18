import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { DeliveryOnboardingWizardService } from '../services/delivery-onboarding-wizard.service';

/**
 * The single source of truth for where an authenticated delivery partner belongs, given their
 * onboarding progress and verification stage. A partner only ever becomes reachable
 * (dashboard/assignments/fees/profile/etc.) once verification is APPROVED — see
 * DeliveryVerificationService on the backend, the only place that flips isVerified in response
 * to admin review. Exact mirror of restaurant-onboarding's onboarding.guard.ts, adapted for
 * delivery's split onboarding/verification endpoints (restaurant has a single
 * Restaurant.status field; delivery splits progress and verification into two responses).
 */
function resolveDestination(
  onboardingStatus: string,
  verificationStage: string,
): string {
  if (verificationStage === 'SUSPENDED') {
    return '/onboarding/suspended';
  }

  if (verificationStage === 'APPROVED') {
    return '/dashboard';
  }

  if (
    onboardingStatus === 'SUBMITTED' ||
    onboardingStatus === 'UNDER_REVIEW' ||
    onboardingStatus === 'REJECTED' ||
    verificationStage === 'REJECTED'
  ) {
    return '/onboarding/waiting-approval';
  }

  return '/onboarding';
}

async function loadDestination(service: DeliveryOnboardingWizardService): Promise<string> {
  try {
    const [onboarding, verification] = await Promise.all([service.getState(), service.getVerification()]);
    return resolveDestination(onboarding.status, verification.stage);
  } catch {
    return '/onboarding';
  }
}

function redirectUnless(expected: string): CanActivateFn {
  return async () => {
    const service = inject(DeliveryOnboardingWizardService);
    const router = inject(Router);

    const destination = await loadDestination(service);

    return destination === expected ? true : router.createUrlTree([destination]);
  };
}

/** Blocks Dashboard/Assignments/Fees/Profile/Vehicles/Documents/Bank/Compliance until
 *  verification is APPROVED. */
export const onboardingGuard: CanActivateFn = redirectUnless('/dashboard');

/** Sends a partner who is already past the wizard stage away from `/onboarding` itself. */
export const onboardingEntryGuard: CanActivateFn = redirectUnless('/onboarding');

/** Only reachable once the application has actually been submitted. */
export const onboardingWaitingApprovalGuard: CanActivateFn = redirectUnless('/onboarding/waiting-approval');

/** Only reachable while the partner is suspended. */
export const onboardingSuspendedGuard: CanActivateFn = redirectUnless('/onboarding/suspended');
