import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthCardComponent, AuthLayoutComponent } from '@patheya-express-frontend/ui';

@Component({
  selector: 'app-partner-onboarding-page',
  standalone: true,
  imports: [AuthLayoutComponent, AuthCardComponent, RouterLink],
  templateUrl: './partner-onboarding.page.html',
  styleUrl: './partner-onboarding.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOnboardingPageComponent {}
