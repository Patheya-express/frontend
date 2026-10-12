import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CurrentDeliveryPartnerService } from '@patheya-express-frontend/core';
import { DeliveryProfileFeatureService } from '../services/delivery-profile.service';
import { DeliveryProfileStore } from './delivery-profile.store';

/** Profile saves — confirmation on success, the backend's reason on failure, and no stale
 *  confirmation lingering after a later failure. */
describe('DeliveryProfileStore', () => {
  let service: { getMyProfile: jest.Mock; updateMyProfile: jest.Mock };
  let store: DeliveryProfileStore;

  beforeEach(() => {
    service = {
      getMyProfile: jest.fn().mockResolvedValue({ id: 'partner-1' }),
      updateMyProfile: jest
        .fn()
        .mockResolvedValue({ id: 'partner-1', currentCity: 'Hyderabad' }),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DeliveryProfileFeatureService, useValue: service },
        {
          provide: CurrentDeliveryPartnerService,
          useValue: { invalidate: jest.fn() },
        },
      ],
    });
    store = TestBed.inject(DeliveryProfileStore);
  });

  it('confirms a successful save', async () => {
    expect(await store.update({ currentCity: 'Hyderabad' })).toBe(true);
    expect(store.saveSuccess()).toBe('Your changes have been saved.');
    expect(store.saveError()).toBeNull();
  });

  it("shows the backend's reason and clears the previous confirmation on failure", async () => {
    await store.update({ currentCity: 'Hyderabad' });
    service.updateMyProfile.mockRejectedValue(
      new HttpErrorResponse({
        status: 400,
        error: { message: 'dateOfBirth must be a Date instance' },
      }),
    );

    expect(await store.update({ currentCity: 'x' })).toBe(false);
    expect(store.saveError()).toBe('dateOfBirth must be a Date instance');
    expect(store.saveSuccess()).toBeNull();
  });
});
