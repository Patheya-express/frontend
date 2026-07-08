import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { RestaurantSummaryDto } from '@patheya-express-frontend/api-sdk';
import { MediaUrlService } from '@patheya-express-frontend/core';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { FavoriteButtonComponent } from '@patheya-express-frontend/favorites';

@Component({
  selector: 'lib-restaurant-card',
  standalone: true,
  imports: [RouterLink, FavoriteButtonComponent],
  templateUrl: './restaurant-card.component.html',
  styleUrl: './restaurant-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantCardComponent {
  @Input({ required: true }) restaurant!: RestaurantSummaryDto;

  private readonly mediaUrlService = inject(MediaUrlService);
  private readonly authFacade = inject(AuthFacade);

  protected readonly isAuthenticated = this.authFacade.isAuthenticated;

  protected get logoUrl(): string | undefined {
    return this.mediaUrlService.resolve(this.restaurant.logoUrl);
  }

  protected get ratingLabel(): string {
    return this.restaurant.ratingCount > 0 ? this.restaurant.avgRating.toFixed(1) : 'New';
  }

  protected get cuisineLabel(): string {
    return this.restaurant.cuisines.length > 0 ? this.restaurant.cuisines.join(', ') : 'Multi-cuisine';
  }

  protected get deliveryTimeLabel(): string {
    return this.restaurant.avgDeliveryTimeMinutes != null ? `${this.restaurant.avgDeliveryTimeMinutes} min` : '';
  }
}
