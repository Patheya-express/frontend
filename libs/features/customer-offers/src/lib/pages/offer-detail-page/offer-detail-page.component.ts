import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { EmptyStateComponent, ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { MediaUrlService } from '@patheya-express-frontend/core';
import { CustomerOffersFacade } from '../../facades/customer-offers.facade';

const EXPIRING_SOON_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

@Component({
  selector: 'lib-offer-detail-page',
  standalone: true,
  imports: [RouterLink, SkeletonComponent, EmptyStateComponent, ErrorStateComponent],
  templateUrl: './offer-detail-page.component.html',
  styleUrl: './offer-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferDetailPageComponent implements OnInit {
  protected readonly facade = inject(CustomerOffersFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly mediaUrlService = inject(MediaUrlService);

  ngOnInit(): void {
    this.route.paramMap.pipe(switchMap((params) => this.facade.loadOfferById(params.get('id') ?? ''))).subscribe();
  }

  protected get imageUrl(): string | undefined {
    return this.mediaUrlService.resolve(this.facade.selectedOffer()?.imageUrl);
  }

  protected get typeLabel(): string | undefined {
    const type = this.facade.selectedOffer()?.type;
    if (!type) {
      return undefined;
    }

    return type
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }

  protected get expirationLabel(): string | undefined {
    const endsAtRaw = this.facade.selectedOffer()?.endsAt;
    if (!endsAtRaw) {
      return undefined;
    }

    const endsAt = new Date(endsAtRaw);
    return endsAt.getTime() - Date.now() <= 0 ? 'This offer has expired' : `Valid until ${endsAt.toLocaleString()}`;
  }

  protected get isExpiringSoon(): boolean {
    const endsAtRaw = this.facade.selectedOffer()?.endsAt;
    if (!endsAtRaw) {
      return false;
    }

    return new Date(endsAtRaw).getTime() - Date.now() <= EXPIRING_SOON_THRESHOLD_MS;
  }

  protected goToRestaurant(): void {
    const restaurantId = this.facade.selectedOffer()?.restaurantId;
    if (restaurantId) {
      void this.router.navigate(['/restaurants', restaurantId]);
    }
  }

  protected retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      void this.facade.loadOfferById(id);
    }
  }
}
