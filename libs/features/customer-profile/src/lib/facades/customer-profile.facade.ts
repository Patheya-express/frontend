import { Injectable, inject } from '@angular/core';
import type {
  ChangePasswordDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from '@patheya-express-frontend/api-sdk';
import { CustomerProfileStore } from '../store/customer-profile.store';

@Injectable({ providedIn: 'root' })
export class CustomerProfileFacade {
  private readonly store = inject(CustomerProfileStore);

  readonly profile = this.store.profile;
  readonly loading = this.store.loading;
  readonly saving = this.store.saving;
  readonly error = this.store.error;
  readonly avatarUrl = this.store.avatarUrl;
  readonly avatarUploading = this.store.avatarUploading;

  readonly preferences = this.store.preferences;
  readonly preferencesLoading = this.store.preferencesLoading;
  readonly preferencesSaving = this.store.preferencesSaving;

  readonly passwordSaving = this.store.passwordSaving;
  readonly passwordError = this.store.passwordError;
  readonly passwordSuccess = this.store.passwordSuccess;

  readonly deleting = this.store.deleting;
  readonly deleted = this.store.deleted;

  ensureProfileLoaded(): Promise<void> {
    return this.store.ensureProfileLoaded();
  }

  loadProfile(): Promise<void> {
    return this.store.loadProfile();
  }

  updateProfile(dto: UpdateProfileDto): Promise<boolean> {
    return this.store.updateProfile(dto);
  }

  uploadAvatar(file: File): Promise<boolean> {
    return this.store.uploadAvatar(file);
  }

  loadPreferences(): Promise<void> {
    return this.store.loadPreferences();
  }

  updatePreferences(dto: UpdatePreferencesDto): Promise<boolean> {
    return this.store.updatePreferences(dto);
  }

  changePassword(dto: ChangePasswordDto): Promise<boolean> {
    return this.store.changePassword(dto);
  }

  deleteAccount(): Promise<boolean> {
    return this.store.deleteAccount();
  }
}
