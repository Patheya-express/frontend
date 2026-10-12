import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CurrentDeliveryPartnerService } from '@patheya-express-frontend/core';
import { DeliveryOnboardingWizardService } from '../services/delivery-onboarding-wizard.service';
import { DeliveryOnboardingWizardStore } from './delivery-onboarding-wizard.store';

/**
 * Onboarding wizard state — background-check consent is recorded on the backend before step 11
 * completes; backend step-validation messages (e.g. "Step 4 is not complete: …") reach the
 * partner; uploads are checked against the real limits before any network call.
 */
describe('DeliveryOnboardingWizardStore', () => {
  let service: {
    recordBackgroundCheckConsent: jest.Mock;
    completeStep: jest.Mock;
    uploadDocument: jest.Mock;
    updateProfile: jest.Mock;
  };
  let store: DeliveryOnboardingWizardStore;

  const ONBOARDING = {
    id: 'onboarding-1',
    status: 'IN_PROGRESS',
    currentStep: 11,
    completedSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  };

  beforeEach(() => {
    service = {
      recordBackgroundCheckConsent: jest.fn().mockResolvedValue({
        ...ONBOARDING,
        backgroundCheckConsentAt: '2026-10-12T10:00:00.000Z',
      }),
      completeStep: jest.fn().mockResolvedValue({
        ...ONBOARDING,
        completedSteps: [...ONBOARDING.completedSteps, 11],
      }),
      uploadDocument: jest.fn(),
      updateProfile: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DeliveryOnboardingWizardService, useValue: service },
        {
          provide: CurrentDeliveryPartnerService,
          useValue: { invalidate: jest.fn() },
        },
      ],
    });
    store = TestBed.inject(DeliveryOnboardingWizardStore);
  });

  it('records background-check consent on the backend before completing step 11', async () => {
    expect(await store.completeBackgroundVerificationStep()).toBe(true);

    const consentOrder =
      service.recordBackgroundCheckConsent.mock.invocationCallOrder[0];
    const stepOrder = service.completeStep.mock.invocationCallOrder[0];
    expect(consentOrder).toBeLessThan(stepOrder);
    expect(service.completeStep).toHaveBeenCalledWith(11);
    expect(store.onboarding()?.completedSteps).toContain(11);
  });

  it('does not complete step 11 when recording consent fails, and says why', async () => {
    service.recordBackgroundCheckConsent.mockRejectedValue(
      new HttpErrorResponse({ status: 0 }),
    );

    expect(await store.completeBackgroundVerificationStep()).toBe(false);
    expect(service.completeStep).not.toHaveBeenCalled();
    expect(store.saveError()).toBe(
      'Unable to save this step. Please check the form and try again.',
    );
  });

  it("shows the backend's step-validation message when a step is refused", async () => {
    service.completeStep.mockRejectedValue(
      new HttpErrorResponse({
        status: 400,
        error: {
          message:
            'Step 11 is not complete: Give your consent to the background verification check first',
        },
      }),
    );

    await store.completeBackgroundVerificationStep();

    expect(store.saveError()).toBe(
      'Step 11 is not complete: Give your consent to the background verification check first',
    );
  });

  it('rejects an unsupported document type before uploading', async () => {
    const ok = await store.uploadDrivingLicense(
      new File(['x'], 'licence.gif', { type: 'image/gif' }),
    );

    expect(ok).toBe(false);
    expect(service.uploadDocument).not.toHaveBeenCalled();
    expect(store.saveError()).toBe(
      'Please choose a JPG, PNG, WebP or PDF file.',
    );
  });

  it('rejects a document over 10 MB before uploading', async () => {
    const ok = await store.uploadDrivingLicense(
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'licence.pdf', {
        type: 'application/pdf',
      }),
    );

    expect(ok).toBe(false);
    expect(service.uploadDocument).not.toHaveBeenCalled();
    expect(store.saveError()).toBe(
      'This file is larger than 10 MB. Choose a smaller file.',
    );
  });

  it('only accepts images for the selfie (5 MB image limit)', async () => {
    const ok = await store.uploadSelfie(
      new File(['%PDF'], 'selfie.pdf', { type: 'application/pdf' }),
    );

    expect(ok).toBe(false);
    expect(store.saveError()).toBe('Please choose a JPG, PNG or WebP file.');
  });

  it('surfaces the backend reason when an upload fails, and allows a retry', async () => {
    service.uploadDocument
      .mockRejectedValueOnce(
        new HttpErrorResponse({
          status: 400,
          error: { message: 'Unsupported file type' },
        }),
      )
      .mockResolvedValueOnce({ id: 'doc-1', documentType: 'DRIVING_LICENSE' });
    const file = new File(['x'], 'licence.jpg', { type: 'image/jpeg' });

    expect(await store.uploadDrivingLicense(file)).toBe(false);
    expect(store.saveError()).toBe('Unsupported file type');

    expect(await store.uploadDrivingLicense(file)).toBe(true);
    expect(store.saveError()).toBeNull();
    expect(store.documentsByType().get('DRIVING_LICENSE')?.id).toBe('doc-1');
  });
});
