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
  selector: 'app-delivery-landing-page',
  standalone: true,
  imports: [RouterLink, HeroSectionComponent, FeatureCardComponent, CtaSectionComponent, FooterComponent],
  templateUrl: './delivery-landing.page.html',
  styleUrl: './delivery-landing.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryLandingPageComponent {
  protected readonly ctaActions: CtaAction[] = [
    { label: 'Join as Delivery Partner', routerLink: '/partner/join', variant: 'primary' },
    { label: 'Courier Login', routerLink: '/auth/login', variant: 'secondary' },
  ];
}
