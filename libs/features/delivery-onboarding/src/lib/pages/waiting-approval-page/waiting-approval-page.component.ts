import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SkeletonComponent } from '@patheya-express-frontend/ui';
import { DeliveryOnboardingWizardFacade } from '../../facades/delivery-onboarding-wizard.facade';

/**
 * Shown once the application has been submitted — the partner cannot reach any operational
 * screen (dashboard/assignments/fees/etc.) from here; only the wizard (for CHANGES_REQUESTED,
 * handled by redirecting back to `/onboarding`) or this status view are reachable, enforced by
 * the onboarding guards.
 */
@Component({
  selector: 'lib-waiting-approval-page',
  standalone: true,
  imports: [DatePipe, SkeletonComponent],
  templateUrl: './waiting-approval-page.component.html',
  styleUrl: './waiting-approval-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitingApprovalPageComponent implements OnInit {
  protected readonly facade = inject(DeliveryOnboardingWizardFacade);

  protected readonly supportEmail = 'partners@patheyaexpress.com';
  protected readonly supportPhone = '+91 1800-000-000';

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected retry(): void {
    this.facade.refresh();
  }
}
