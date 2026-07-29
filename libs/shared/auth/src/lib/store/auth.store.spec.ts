import { TestBed } from '@angular/core/testing';
import { AuthService as GeneratedAuthService } from '@patheya-express-frontend/api-sdk';
import { AuthStore } from './auth.store';
import { LogoutCleanupRegistry } from '../services/logout-cleanup-registry.service';

/**
 * Sprint 1.4 — logout must actually destroy the session: revoke the refresh token server-side
 * (best-effort), wipe the three localStorage keys, null out the in-memory signals, and run every
 * registered LogoutCleanupRegistry handler (the mechanism the rest of the app's stores/services
 * use to reset themselves — see that service's doc comment). Also covers cross-tab sync: a
 * *different* same-browser tab logging out clears localStorage, and this tab must mirror that
 * into its own state without re-calling the backend.
 *
 * Only the generated SDK's AuthService (the actual network boundary) is faked — AuthStore,
 * AuthService (the thin wrapper), AuthStorageService, and LogoutCleanupRegistry all run as real,
 * unmodified production code.
 */
describe('AuthStore — logout / session teardown', () => {
  let logoutSpy: jest.Mock;
  let store: AuthStore;
  let registry: LogoutCleanupRegistry;

  function envelope<T>(data: T) {
    return { success: true, timestamp: new Date().toISOString(), data };
  }

  function seedStoredSession(overrides: { accessToken?: string; refreshToken?: string } = {}) {
    localStorage.setItem('patheya.auth.accessToken', overrides.accessToken ?? 'access-token-1');
    localStorage.setItem('patheya.auth.refreshToken', overrides.refreshToken ?? 'refresh-token-1');
    localStorage.setItem(
      'patheya.auth.user',
      JSON.stringify({ id: 'user-1', email: 'user@example.com', role: 'CUSTOMER' }),
    );
  }

  beforeEach(() => {
    localStorage.clear();
    logoutSpy = jest.fn().mockResolvedValue(envelope({ message: 'Logged out successfully' }));

    TestBed.configureTestingModule({
      providers: [{ provide: GeneratedAuthService, useValue: { authControllerLogout: logoutSpy } }],
    });

    store = TestBed.inject(AuthStore);
    registry = TestBed.inject(LogoutCleanupRegistry);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('sends the stored refresh token to the backend logout call', async () => {
    seedStoredSession({ refreshToken: 'the-refresh-token' });
    store.initialize();

    await store.logout();

    expect(logoutSpy).toHaveBeenCalledWith({ body: { refreshToken: 'the-refresh-token' } });
  });

  it('clears all three localStorage keys and the in-memory session', async () => {
    seedStoredSession();
    store.initialize();
    expect(store.isAuthenticated()).toBe(true);

    await store.logout();

    expect(localStorage.getItem('patheya.auth.accessToken')).toBeNull();
    expect(localStorage.getItem('patheya.auth.refreshToken')).toBeNull();
    expect(localStorage.getItem('patheya.auth.user')).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
    expect(store.getAccessToken()).toBeNull();
  });

  it('still clears local session even when the server-side logout call fails', async () => {
    seedStoredSession();
    store.initialize();
    logoutSpy.mockRejectedValue(new Error('network error'));

    await store.logout();

    expect(store.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('patheya.auth.accessToken')).toBeNull();
  });

  it('runs every registered LogoutCleanupRegistry handler on logout', async () => {
    seedStoredSession();
    store.initialize();
    const cartReset = jest.fn();
    const walletReset = jest.fn();
    registry.register(cartReset);
    registry.register(walletReset);

    await store.logout();

    expect(cartReset).toHaveBeenCalledTimes(1);
    expect(walletReset).toHaveBeenCalledTimes(1);
  });

  it('does nothing when logout is called with no stored session (never calls the backend)', async () => {
    await store.logout();

    expect(logoutSpy).not.toHaveBeenCalled();
    expect(store.isAuthenticated()).toBe(false);
  });

  describe('cross-tab logout sync', () => {
    it('a storage event reflecting another tab clearing the auth keys logs this tab out locally, without calling the backend', () => {
      seedStoredSession();
      store.initialize();
      expect(store.isAuthenticated()).toBe(true);

      // Simulate the OTHER tab's AuthStorageService.clear() having already run — this tab only
      // finds out via the storage event, exactly like a real second tab would.
      localStorage.removeItem('patheya.auth.accessToken');
      localStorage.removeItem('patheya.auth.refreshToken');
      localStorage.removeItem('patheya.auth.user');
      window.dispatchEvent(new Event('storage'));

      expect(store.isAuthenticated()).toBe(false);
      expect(store.user()).toBeNull();
      expect(logoutSpy).not.toHaveBeenCalled();
    });

    it('also runs the LogoutCleanupRegistry handlers on cross-tab sync', () => {
      seedStoredSession();
      store.initialize();
      const handler = jest.fn();
      registry.register(handler);

      localStorage.clear();
      window.dispatchEvent(new Event('storage'));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('ignores a storage event that still leaves a valid session behind (e.g. token rotation in another tab)', () => {
      seedStoredSession();
      store.initialize();
      const handler = jest.fn();
      registry.register(handler);

      // A refresh in another tab rotates the tokens but the session stays present — must not be
      // mistaken for a logout.
      localStorage.setItem('patheya.auth.accessToken', 'rotated-access-token');
      localStorage.setItem('patheya.auth.refreshToken', 'rotated-refresh-token');
      window.dispatchEvent(new Event('storage'));

      expect(store.isAuthenticated()).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });

    it('a storage event while already logged out is a no-op', () => {
      const handler = jest.fn();
      registry.register(handler);

      window.dispatchEvent(new Event('storage'));

      expect(handler).not.toHaveBeenCalled();
      expect(logoutSpy).not.toHaveBeenCalled();
    });
  });
});
