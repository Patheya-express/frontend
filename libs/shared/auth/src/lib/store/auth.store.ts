import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  AuthUserDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  RegisterResponseDto,
  ResetPasswordDto,
} from '@patheya-express-frontend/api-sdk';
import { AuthService } from '../services/auth.service';
import { AuthStorageService } from '../storage/auth-storage.service';
import { LogoutCleanupRegistry } from '../services/logout-cleanup-registry.service';

/**
 * Same convention as `coupon.store.ts`'s `extractMessage` — prefers the backend's own error
 * message when the API returned one, rather than always showing one hardcoded string regardless
 * of cause. `status === 0` (no response received at all — offline, DNS failure, server
 * unreachable) is called out specifically since that case has no response body to read a message
 * from, and was previously indistinguishable from "wrong password"/"email already registered".
 */
function extractAuthErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return "Can't reach the server. Check your connection and try again.";
    }
    if (typeof error.error?.message === 'string') {
      return error.error.message;
    }
  }
  return fallback;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authService = inject(AuthService);
  private readonly authStorage = inject(AuthStorageService);
  private readonly logoutCleanupRegistry = inject(LogoutCleanupRegistry);

  private readonly _user = signal<AuthUserDto | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  /** True only when the session ended involuntarily (refresh token expired/invalid) — never set
   *  by an explicit `logout()` call, so the app-level effect that reacts to this (navigating to
   *  login with a `redirectTo` back to wherever the user was) never fires on a deliberate log out,
   *  where landing on a neutral post-logout screen is the right call instead. */
  private readonly _sessionExpired = signal(false);

  readonly user = this._user.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isAuthenticated = computed(() => !!this._accessToken());
  readonly sessionExpired = this._sessionExpired.asReadonly();

  constructor() {
    // Same-browser tabs share localStorage: when a different tab logs out, it clears the auth
    // keys there, but this tab's own in-memory signals and feature-store state are untouched
    // until something tells it to react. Rather than call the backend logout again (nothing left
    // to revoke — the other tab's request already did it), this just mirrors the already-cleared
    // storage into this tab's own state.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', () => this.handleStorageEvent());
    }
  }

  /** Native only — no-op on web. Must be awaited before `initialize()` so the secure-storage-
   *  backed in-memory cache `initialize()` reads from is actually populated. See
   *  `AuthStorageService`'s doc comment for why this two-step shape exists. */
  hydrateNativeSession(): Promise<void> {
    return this.authStorage.hydrate();
  }

  /** Hydrates session state from persisted storage. Call once at app bootstrap. */
  initialize(): void {
    const session = this.authStorage.load();
    if (session) {
      this._accessToken.set(session.accessToken);
      this._user.set(session.user);
    }
  }

  getAccessToken(): string | null {
    return this._accessToken();
  }

  async register(dto: RegisterDto): Promise<boolean> {
    return this.runRegistration(() => this.authService.register(dto));
  }

  async registerDeliveryPartner(dto: RegisterDto): Promise<boolean> {
    return this.runRegistration(() => this.authService.registerDeliveryPartner(dto));
  }

  async registerRestaurantOwner(dto: RegisterDto): Promise<boolean> {
    return this.runRegistration(() => this.authService.registerRestaurantOwner(dto));
  }

  private async runRegistration(register: () => Promise<RegisterResponseDto>): Promise<boolean> {
    if (this._loading()) {
      return false;
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await register();
      this.applySession(response.accessToken, response.refreshToken, response.user);
      return true;
    } catch (err) {
      this._error.set(
        extractAuthErrorMessage(err, 'Unable to create your account. The email may already be registered.'),
      );
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  async login(dto: LoginDto): Promise<boolean> {
    if (this._loading()) {
      return false;
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await this.authService.login(dto);
      this.applySession(response.accessToken, response.refreshToken, response.user);
      return true;
    } catch (err) {
      this._error.set(extractAuthErrorMessage(err, 'Invalid email or password.'));
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  async logout(): Promise<void> {
    const session = this.authStorage.load();

    if (session) {
      try {
        await this.authService.logout(session.refreshToken);
      } catch {
        // Best-effort: local session is cleared regardless of server-side revocation outcome.
      }
    }

    this.clearLocalSession();
  }

  /**
   * Fires on every `storage` event this tab receives — including sessionStorage changes and this
   * tab's own writes reflected back, since jsdom/browser `StorageEvent.storageArea` isn't reliable
   * enough to filter on. Deliberately re-derives everything from actual current state instead of
   * trying to interpret the event payload: the only case that matters is a *different* tab having
   * just logged out (authStorage.clear() removes the auth keys from localStorage), which this tab
   * wouldn't otherwise notice until its next 401. Every other kind of storage change is a safe
   * no-op here — a login, a token rotation, or an unrelated sessionStorage write all leave
   * authStorage.load() returning non-null (or this tab was never logged in to begin with), so
   * neither guard below fires.
   */
  private handleStorageEvent(): void {
    if (this.authStorage.load() !== null) {
      return;
    }

    if (!this._accessToken()) {
      return;
    }

    this.clearLocalSession();
  }

  /** The local-only half of logout — used both by logout() itself (after the best-effort server
   *  call) and by cross-tab sync (where the server call already happened, in the other tab). */
  private clearLocalSession(): void {
    this.authStorage.clear();
    this._accessToken.set(null);
    this._user.set(null);
    this.logoutCleanupRegistry.runAll();
  }

  /**
   * Called by the auth interceptor when a request 401s. Refresh tokens rotate on every use
   * (backend revokes the presented one and issues a new pair), so both stored tokens are
   * replaced together, not just the access token. Returns false — and forces a full logout —
   * if the stored refresh token is itself missing, expired, or already revoked; the interceptor
   * treats `false` as "give up," never retrying more than this one time.
   */
  async refreshSession(): Promise<boolean> {
    const session = this.authStorage.load();

    if (!session) {
      return false;
    }

    try {
      const response = await this.authService.refreshToken(session.refreshToken);

      this.authStorage.save({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: session.user,
      });
      this._accessToken.set(response.accessToken);

      return true;
    } catch {
      this._sessionExpired.set(true);
      await this.logout();
      return false;
    }
  }

  /** Called once the app-level effect watching `sessionExpired` has navigated the user to login
   *  — resets the flag so it doesn't linger true and re-fire once they authenticate again. */
  acknowledgeSessionExpiry(): void {
    this._sessionExpired.set(false);
  }

  /** Always resolves true on a successful request — the backend returns the same generic
   *  message whether or not the email matched an account, so there's no "did it work" signal
   *  beyond the request itself succeeding. */
  async forgotPassword(dto: ForgotPasswordDto): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await this.authService.forgotPassword(dto);
      return true;
    } catch (err) {
      this._error.set(extractAuthErrorMessage(err, 'Something went wrong. Please try again.'));
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await this.authService.resetPassword(dto);
      return true;
    } catch (err) {
      this._error.set(extractAuthErrorMessage(err, 'This reset link is invalid or has expired.'));
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  private applySession(accessToken: string, refreshToken: string, user: AuthUserDto): void {
    this.authStorage.save({ accessToken, refreshToken, user });
    this._accessToken.set(accessToken);
    this._user.set(user);
  }
}
