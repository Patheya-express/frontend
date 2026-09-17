import type { OnboardingResponseDto, RestaurantResponseDto } from '@patheya-express-frontend/api-sdk';
import { resolveDestination } from './onboarding.guard';

/**
 * Regression coverage for the "approved restaurant stuck on /onboarding/waiting-approval" defect
 * (see apps/api-gateway's onboarding-verification-decision.listener.ts fix) — this is the exact
 * routing decision function the restaurant-app's onboarding guards (onboardingGuard/
 * onboardingEntryGuard/onboardingWaitingApprovalGuard/onboardingSuspendedGuard) all delegate to,
 * so testing it directly covers every guard's actual decision without needing to stand up
 * Angular's router/DI machinery for each one.
 */
function onboarding(status: OnboardingResponseDto['status']): OnboardingResponseDto {
  return { status } as OnboardingResponseDto;
}

function restaurant(status: RestaurantResponseDto['status']): RestaurantResponseDto {
  return { status } as RestaurantResponseDto;
}

describe('resolveDestination', () => {
  it('sends an APPROVED onboarding application to /dashboard, regardless of Restaurant.status (APPROVED)', () => {
    expect(resolveDestination(onboarding('APPROVED'), restaurant('APPROVED'))).toBe('/dashboard');
  });

  it("does not fall back to Restaurant.status — an APPROVED restaurant with a non-APPROVED onboarding record is NOT sent to /dashboard (the exact defect: Restaurant.status alone must never be read as 'approved')", () => {
    expect(resolveDestination(onboarding('UNDER_REVIEW'), restaurant('APPROVED'))).not.toBe('/dashboard');
    expect(resolveDestination(onboarding('SUBMITTED'), restaurant('APPROVED'))).not.toBe('/dashboard');
  });

  it.each(['SUBMITTED', 'UNDER_REVIEW', 'REJECTED'] as const)(
    'sends a %s onboarding application to /onboarding/waiting-approval',
    (status) => {
      expect(resolveDestination(onboarding(status), restaurant('PENDING'))).toBe('/onboarding/waiting-approval');
    },
  );

  it.each(['DRAFT', 'IN_PROGRESS', 'CHANGES_REQUESTED'] as const)(
    'sends a %s onboarding application back to the wizard (/onboarding)',
    (status) => {
      expect(resolveDestination(onboarding(status), restaurant('PENDING'))).toBe('/onboarding');
    },
  );

  it('sends a SUSPENDED restaurant to /onboarding/suspended even if onboarding itself reads APPROVED', () => {
    expect(resolveDestination(onboarding('APPROVED'), restaurant('SUSPENDED'))).toBe('/onboarding/suspended');
  });

  it('SUSPENDED restaurant takes precedence over a still-under-review onboarding application', () => {
    expect(resolveDestination(onboarding('UNDER_REVIEW'), restaurant('SUSPENDED'))).toBe('/onboarding/suspended');
  });
});
