import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import type { UpdatePreferencesDto, NotificationPreferencesResponseDto } from '@patheya-express-frontend/api-sdk';
import { CustomerProfileFacade } from '@patheya-express-frontend/customer-profile';

type PreferenceKey = keyof NotificationPreferencesResponseDto;

interface PreferenceRow {
  label: string;
  emailKey: PreferenceKey;
  smsKey: PreferenceKey;
  pushKey: PreferenceKey;
}

const ROWS: PreferenceRow[] = [
  { label: 'Order updates', emailKey: 'orderUpdatesEmail', smsKey: 'orderUpdatesSms', pushKey: 'orderUpdatesPush' },
  { label: 'Promotions', emailKey: 'promotionsEmail', smsKey: 'promotionsSms', pushKey: 'promotionsPush' },
  { label: 'Reviews', emailKey: 'reviewsEmail', smsKey: 'reviewsSms', pushKey: 'reviewsPush' },
  { label: 'System notifications', emailKey: 'systemEmail', smsKey: 'systemSms', pushKey: 'systemPush' },
];

@Component({
  selector: 'lib-preferences-form',
  standalone: true,
  templateUrl: './preferences-form.component.html',
  styleUrl: './preferences-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreferencesFormComponent implements OnInit {
  private readonly facade = inject(CustomerProfileFacade);

  protected readonly rows = ROWS;
  protected readonly preferences = this.facade.preferences;
  protected readonly loading = this.facade.preferencesLoading;
  protected readonly saving = this.facade.preferencesSaving;

  ngOnInit(): void {
    void this.facade.loadPreferences();
  }

  protected isChecked(key: PreferenceKey): boolean {
    return this.preferences()?.[key] ?? false;
  }

  protected toggle(key: PreferenceKey): void {
    const current = this.preferences();
    if (!current) {
      return;
    }

    const dto: UpdatePreferencesDto = { [key]: !current[key] };
    void this.facade.updatePreferences(dto);
  }
}
