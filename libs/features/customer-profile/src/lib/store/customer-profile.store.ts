import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  ChangePasswordDto,
  NotificationPreferencesResponseDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  UserResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { CustomerProfileService } from '../services/customer-profile.service';

@Injectable({ providedIn: 'root' })
export class CustomerProfileStore {
  private readonly customerProfileService = inject(CustomerProfileService);

  private readonly _profile = signal<UserResponseDto | null>(null);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);

  private readonly _preferences = signal<NotificationPreferencesResponseDto | null>(null);
  private readonly _preferencesLoading = signal(false);
  private readonly _preferencesSaving = signal(false);

  private readonly _passwordSaving = signal(false);
  private readonly _passwordError = signal<string | null>(null);
  private readonly _passwordSuccess = signal(false);

  private readonly _avatarUploading = signal(false);

  private readonly _deleting = signal(false);
  private readonly _deleted = signal(false);

  private loadPromise: Promise<void> | null = null;

  readonly profile = this._profile.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();

  readonly preferences = this._preferences.asReadonly();
  readonly preferencesLoading = this._preferencesLoading.asReadonly();
  readonly preferencesSaving = this._preferencesSaving.asReadonly();

  readonly passwordSaving = this._passwordSaving.asReadonly();
  readonly passwordError = this._passwordError.asReadonly();
  readonly passwordSuccess = this._passwordSuccess.asReadonly();

  readonly avatarUploading = this._avatarUploading.asReadonly();

  readonly deleting = this._deleting.asReadonly();
  readonly deleted = this._deleted.asReadonly();

  readonly avatarUrl = computed(() => this._profile()?.avatarUrl);

  /** Idempotent — safe to call from multiple consumers (header + profile page) without duplicate requests. */
  async ensureProfileLoaded(): Promise<void> {
    if (this._profile() || this.loadPromise) {
      return this.loadPromise ?? Promise.resolve();
    }

    this.loadPromise = this.loadProfile();
    await this.loadPromise;
    this.loadPromise = null;
  }

  async loadProfile(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const profile = await this.customerProfileService.getProfile();
      this._profile.set(profile);
    } catch {
      this._error.set('Unable to load your profile. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  async updateProfile(dto: UpdateProfileDto): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const profile = await this.customerProfileService.updateProfile(dto);
      this._profile.set(profile);
      return true;
    } catch {
      this._error.set('Unable to update your profile. Please try again.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async uploadAvatar(file: File): Promise<boolean> {
    this._avatarUploading.set(true);
    this._error.set(null);

    try {
      const profile = await this.customerProfileService.uploadAvatar(file);
      this._profile.set(profile);
      return true;
    } catch {
      this._error.set('Unable to upload your photo. Please try again.');
      return false;
    } finally {
      this._avatarUploading.set(false);
    }
  }

  async loadPreferences(): Promise<void> {
    this._preferencesLoading.set(true);

    try {
      const preferences = await this.customerProfileService.getPreferences();
      this._preferences.set(preferences);
    } finally {
      this._preferencesLoading.set(false);
    }
  }

  async updatePreferences(dto: UpdatePreferencesDto): Promise<boolean> {
    this._preferencesSaving.set(true);

    try {
      const preferences = await this.customerProfileService.updatePreferences(dto);
      this._preferences.set(preferences);
      return true;
    } catch {
      return false;
    } finally {
      this._preferencesSaving.set(false);
    }
  }

  async changePassword(dto: ChangePasswordDto): Promise<boolean> {
    this._passwordSaving.set(true);
    this._passwordError.set(null);
    this._passwordSuccess.set(false);

    try {
      await this.customerProfileService.changePassword(dto);
      this._passwordSuccess.set(true);
      return true;
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        this._passwordError.set('Current password is incorrect.');
      } else {
        this._passwordError.set('Unable to change your password. Please try again.');
      }
      return false;
    } finally {
      this._passwordSaving.set(false);
    }
  }

  async deleteAccount(): Promise<boolean> {
    this._deleting.set(true);

    try {
      await this.customerProfileService.deleteAccount();
      this._deleted.set(true);
      return true;
    } catch {
      return false;
    } finally {
      this._deleting.set(false);
    }
  }
}
