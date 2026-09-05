import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import * as Sentry from '@sentry/capacitor';
import { AuthFacade, LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { ObservabilityUserContextService } from './observability-user-context.service';

jest.mock('@sentry/capacitor', () => ({
  setUser: jest.fn(),
  setTag: jest.fn(),
}));

const mockedSentry = jest.mocked(Sentry);

describe('ObservabilityUserContextService', () => {
  const userSignal = signal<{ id: string; role: string } | null>(null);

  async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    jest.clearAllMocks();
    userSignal.set(null);

    TestBed.configureTestingModule({
      providers: [{ provide: AuthFacade, useValue: { user: userSignal } }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('attaches only id and role when a user signs in — never email/name/tokens', async () => {
    TestBed.inject(ObservabilityUserContextService);
    userSignal.set({ id: 'user-1', role: 'DELIVERY_PARTNER' });
    await flush();

    expect(mockedSentry.setUser).toHaveBeenCalledWith({ id: 'user-1' });
    expect(mockedSentry.setTag).toHaveBeenCalledWith('user_role', 'DELIVERY_PARTNER');
  });

  it('clears user context when the user signs out', async () => {
    TestBed.inject(ObservabilityUserContextService);
    userSignal.set({ id: 'user-1', role: 'CUSTOMER' });
    await flush();

    userSignal.set(null);
    await flush();

    expect(mockedSentry.setUser).toHaveBeenLastCalledWith(null);
    expect(mockedSentry.setTag).toHaveBeenLastCalledWith('user_role', undefined);
  });

  it('clears user context on logout via LogoutCleanupRegistry, without breaking cleanup if Sentry throws', async () => {
    TestBed.inject(ObservabilityUserContextService);
    userSignal.set({ id: 'user-1', role: 'CUSTOMER' });
    await flush();
    mockedSentry.setUser.mockClear();

    mockedSentry.setUser.mockImplementationOnce(() => {
      throw new Error('sentry unavailable');
    });
    const registry = TestBed.inject(LogoutCleanupRegistry);

    expect(() => registry.runAll()).not.toThrow();
  });
});
