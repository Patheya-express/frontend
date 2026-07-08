import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChangePasswordFormComponent } from '../../components/change-password-form/change-password-form.component';
import { PreferencesFormComponent } from '../../components/preferences-form/preferences-form.component';
import { DeleteAccountSectionComponent } from '../../components/delete-account-section/delete-account-section.component';

@Component({
  selector: 'lib-account-settings-page',
  standalone: true,
  imports: [RouterLink, ChangePasswordFormComponent, PreferencesFormComponent, DeleteAccountSectionComponent],
  templateUrl: './account-settings-page.component.html',
  styleUrl: './account-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSettingsPageComponent {}
