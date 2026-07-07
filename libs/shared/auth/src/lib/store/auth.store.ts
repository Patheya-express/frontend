import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  AuthUserDto,
  LoginDto,
  RegisterDto,
  RegisterResponseDto,
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

  private applySession(accessToken: string, refreshToken: string, user: AuthUserDto): void {
    this.authStorage.save({ accessToken, refreshToken, user });
    this._accessToken.set(accessToken);
    this._user.set(user);
  }
}
