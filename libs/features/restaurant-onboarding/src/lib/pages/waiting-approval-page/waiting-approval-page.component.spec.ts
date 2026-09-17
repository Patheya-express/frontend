import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { DocumentResponseDto, OnboardingResponseDto } from '@patheya-express-frontend/api-sdk';
import { WaitingApprovalPageComponent } from './waiting-approval-page.component';
import { OnboardingWizardFacade } from '../../facades/onboarding-wizard.facade';

/**
 * Regression coverage for the "blank page, no visible error" defect: the template previously had
 * no branch at all for "not initializing, but onboarding() is still null" — exactly what happens
 * whenever OnboardingWizardStore.fetchAll()'s Promise.all rejects (any transient network/auth
 * failure). The store already captured a message in facade.error() for this case; the template
 * just never rendered it. Fixed by adding the same initializing/error/content three-branch
 * structure the sibling OnboardingWizardPageComponent already uses for this exact store.
 */
describe('WaitingApprovalPageComponent', () => {
  let initializing: ReturnType<typeof signal<boolean>>;
  let error: ReturnType<typeof signal<string | null>>;
  let onboarding: ReturnType<typeof signal<OnboardingResponseDto | null>>;
  let documents: ReturnType<typeof signal<DocumentResponseDto[]>>;
  let initializeMock: jest.Mock;
  let refreshMock: jest.Mock;

  async function createFixture() {
    await TestBed.configureTestingModule({
      imports: [WaitingApprovalPageComponent],
      providers: [
        {
          provide: OnboardingWizardFacade,
          useValue: { initializing, error, onboarding, documents, initialize: initializeMock, refresh: refreshMock },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WaitingApprovalPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    initializing = signal(false);
    error = signal<string | null>(null);
    onboarding = signal<OnboardingResponseDto | null>(null);
    documents = signal<DocumentResponseDto[]>([]);
    initializeMock = jest.fn();
    refreshMock = jest.fn();
  });

  it('calls facade.initialize() on init', async () => {
    await createFixture();
    expect(initializeMock).toHaveBeenCalledTimes(1);
  });

  it('shows the skeleton while initializing, not the blank/error/content states', async () => {
    initializing.set(true);
    const fixture = await createFixture();

    expect(fixture.nativeElement.querySelector('lib-skeleton')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.waiting-card')).toBeNull();
  });

  it('THE FIX: shows the existing lib-error-state (with a working retry) instead of a blank page when fetchAll() failed', async () => {
    initializing.set(false);
    onboarding.set(null);
    error.set('Unable to load your onboarding application. Please refresh and try again.');
    const fixture = await createFixture();

    const errorState = fixture.nativeElement.querySelector('lib-error-state');
    expect(errorState).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Unable to load your onboarding application');
    // Confirms the page is not blank: some content is rendered.
    expect(fixture.nativeElement.querySelector('.waiting-page').textContent.trim().length).toBeGreaterThan(0);

    // The template wires lib-error-state's (retry) output straight to this method — verifying it
    // here (rather than simulating the child component's own internal button click) is the same
    // "call the handler the binding invokes" approach this codebase already uses elsewhere.
    (fixture.componentInstance as unknown as { retry(): void }).retry();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('shows "Application Under Review" content once onboarding data has loaded, even with no documents', async () => {
    onboarding.set({
      id: 'onboarding-1',
      status: 'UNDER_REVIEW',
      submittedAt: '2026-01-01T00:00:00.000Z',
    } as OnboardingResponseDto);
    const fixture = await createFixture();

    expect(fixture.nativeElement.textContent).toContain('Application Under Review');
    expect(fixture.nativeElement.textContent).toContain('No documents uploaded.');
  });

  it('shows the rejected variant for a REJECTED application', async () => {
    onboarding.set({ id: 'onboarding-1', status: 'REJECTED' } as OnboardingResponseDto);
    const fixture = await createFixture();

    expect(fixture.nativeElement.textContent).toContain('Application Rejected');
  });
});
