import { ChangeDetectionStrategy, Component, OnInit, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { CustomerProfileFacade } from '@patheya-express-frontend/customer-profile';
import { AvatarUploadComponent } from '../../components/avatar-upload/avatar-upload.component';

const THEME_OPTIONS = [
  { value: 'SYSTEM', label: 'Match system' },
  { value: 'LIGHT', label: 'Light' },
  { value: 'DARK', label: 'Dark' },
] as const;

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'te', label: 'Telugu' },
  { value: 'kn', label: 'Kannada' },
] as const;

@Component({
  selector: 'lib-profile-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SkeletonComponent, ErrorStateComponent, AvatarUploadComponent],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly facade = inject(CustomerProfileFacade);

  protected readonly themeOptions = THEME_OPTIONS;
  protected readonly languageOptions = LANGUAGE_OPTIONS;

  protected readonly profile = this.facade.profile;
  protected readonly loading = this.facade.loading;
  protected readonly saving = this.facade.saving;
  protected readonly error = this.facade.error;
  protected readonly avatarUploading = this.facade.avatarUploading;

  protected readonly form = this.fb.nonNullable.group({
    firstName: [''],
    lastName: [''],
    phone: [''],
    preferredLanguage: ['en'],
    themePreference: ['SYSTEM' as 'LIGHT' | 'DARK' | 'SYSTEM'],
    timezone: ['Asia/Kolkata'],
    marketingOptIn: [false],
  });

  protected saved = false;

  constructor() {
    effect(() => {
      const profile = this.profile();
      if (profile) {
        this.form.setValue({
          firstName: profile.firstName ?? '',
          lastName: profile.lastName ?? '',
          phone: profile.phone ?? '',
          preferredLanguage: profile.preferredLanguage,
          themePreference: profile.themePreference,
          timezone: profile.timezone,
          marketingOptIn: profile.marketingOptIn,
        });
      }
    });
  }

  ngOnInit(): void {
    void this.facade.loadProfile();
  }

  protected async onSubmit(): Promise<void> {
    this.saved = false;
    const ok = await this.facade.updateProfile(this.form.getRawValue());
    this.saved = ok;
  }

  protected async onAvatarSelected(file: File): Promise<void> {
    await this.facade.uploadAvatar(file);
  }

  protected retry(): void {
    void this.facade.loadProfile();
  }
}
