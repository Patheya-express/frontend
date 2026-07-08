import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { OfferResponseDto } from '@patheya-express-frontend/api-sdk';
import { MediaUrlService } from '@patheya-express-frontend/core';

const EXPIRING_SOON_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

@Component({
  selector: 'lib-offer-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './offer-card.component.html',
  styleUrl: './offer-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferCardComponent {
  @Input({ required: true }) offer!: OfferResponseDto;
  @Input() size: 'sm' | 'md' = 'md';

  private readonly mediaUrlService = inject(MediaUrlService);

  protected get imageUrl(): string | undefined {
    return this.mediaUrlService.resolve(this.offer.imageUrl);
  }

  protected get typeLabel(): string | undefined {
    if (!this.offer.type) {
      return undefined;
    }

    return this.offer.type
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }

  protected get expirationLabel(): string | undefined {
    if (!this.offer.endsAt) {
      return undefined;
    }

    const endsAt = new Date(this.offer.endsAt);
    const msRemaining = endsAt.getTime() - Date.now();

    if (msRemaining <= 0) {
      return 'Expired';
    }

    if (msRemaining <= EXPIRING_SOON_THRESHOLD_MS) {
      const hoursRemaining = Math.round(msRemaining / (60 * 60 * 1000));
      return hoursRemaining <= 24 ? `Expires in ${hoursRemaining}h` : `Expires in ${Math.round(hoursRemaining / 24)}d`;
    }

    return `Valid until ${endsAt.toLocaleDateString()}`;
  }

  protected get isExpiringSoon(): boolean {
    if (!this.offer.endsAt) {
      return false;
    }

    return new Date(this.offer.endsAt).getTime() - Date.now() <= EXPIRING_SOON_THRESHOLD_MS;
  }
}
