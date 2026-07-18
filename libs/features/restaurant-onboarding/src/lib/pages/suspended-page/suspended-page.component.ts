import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { OnboardingWizardFacade } from '../../facades/onboarding-wizard.facade';

/** Shown when an already-approved restaurant has been suspended by an admin. */
@Component({
  selector: 'lib-suspended-page',
  standalone: true,
  templateUrl: './suspended-page.component.html',
  styleUrl: './suspended-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuspendedPageComponent implements OnInit {
  protected readonly facade = inject(OnboardingWizardFacade);

  protected readonly supportEmail = 'partners@patheyaexpress.com';
  protected readonly supportPhone = '+91 1800-000-000';

  ngOnInit(): void {
    this.facade.initialize();
  }
}
