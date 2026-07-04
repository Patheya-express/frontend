import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CtaSectionComponent, FooterComponent, HeroSectionComponent, type CtaAction } from '@patheya-express-frontend/ui';

@Component({
  selector: 'app-admin-landing-page',
  standalone: true,
  imports: [HeroSectionComponent, CtaSectionComponent, FooterComponent],
  templateUrl: './admin-landing.page.html',
  styleUrl: './admin-landing.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLandingPageComponent {
  protected readonly ctaActions: CtaAction[] = [
    { label: 'Admin Login', routerLink: '/auth/login', variant: 'primary' },
  ];
}
