import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { OfferResponseDto } from '@patheya-express-frontend/api-sdk';
import { OfferCardComponent } from '../offer-card/offer-card.component';

@Component({
  selector: 'lib-offer-carousel',
  standalone: true,
  imports: [OfferCardComponent],
  templateUrl: './offer-carousel.component.html',
  styleUrl: './offer-carousel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferCarouselComponent {
  @Input({ required: true }) offers: OfferResponseDto[] = [];
  @Input() title?: string;
}
