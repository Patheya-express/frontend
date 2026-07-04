import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CtaSectionComponent,
  FeatureCardComponent,
  FooterComponent,
  HeroSectionComponent,
  type CtaAction,
} from '@patheya-express-frontend/ui';

@Component({
  selector: 'app-restaurant-landing-page',
  standalone: true,
  imports: [RouterLink, HeroSectionComponent, FeatureCardComponent, CtaSectionComponent, FooterComponent],
  templateUrl: './restaurant-landing.page.html',
  styleUrl: './restaurant-landing.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantLandingPageComponent {
  protected readonly ctaActions: CtaAction[] = [
    { label: 'Apply as Restaurant Partner', routerLink: '/partner/apply', variant: 'primary' },
    { label: 'Partner Login', routerLink: '/auth/login', variant: 'secondary' },
  ];
}
