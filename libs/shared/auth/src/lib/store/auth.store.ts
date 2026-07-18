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

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authService = inject(AuthService);
  private readonly authStorage = inject(AuthStorageService);

  private readonly _user = signal<AuthUserDto | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly user = this._user.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isAuthenticated = computed(() => !!this._accessToken());

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
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await register();
      this.applySession(response.accessToken, response.refreshToken, response.user);
      return true;
    } catch {
      this._error.set('Unable to create your account. The email may already be registered.');
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  async login(dto: LoginDto): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await this.authService.login(dto);
      this.applySession(response.accessToken, response.refreshToken, response.user);
      return true;
    } catch {
      this._error.set('Invalid email or password.');
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

    this.authStorage.clear();
    this._accessToken.set(null);
    this._user.set(null);
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
      await this.logout();
      return false;
    }
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
    } catch {
      this._error.set('Something went wrong. Please try again.');
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
    } catch {
      this._error.set('This reset link is invalid or has expired.');
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
