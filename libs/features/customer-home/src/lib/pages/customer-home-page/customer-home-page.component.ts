import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent, ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { RestaurantCardComponent } from '@patheya-express-frontend/restaurant-discovery';
import { MediaUrlService } from '@patheya-express-frontend/core';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { FavoritesFacade } from '@patheya-express-frontend/favorites';
import { CustomerOffersFacade, OfferCarouselComponent } from '@patheya-express-frontend/customer-offers';
import { CustomerHomeFacade } from '../../facades/customer-home.facade';

@Component({
  selector: 'lib-customer-home-page',
  standalone: true,
  imports: [RouterLink, RestaurantCardComponent, SkeletonComponent, EmptyStateComponent, ErrorStateComponent, OfferCarouselComponent],
  templateUrl: './customer-home-page.component.html',
  styleUrl: './customer-home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerHomePageComponent implements OnInit {
  protected readonly facade = inject(CustomerHomeFacade);
  protected readonly offersFacade = inject(CustomerOffersFacade);
  private readonly mediaUrlService = inject(MediaUrlService);
  private readonly authFacade = inject(AuthFacade);
  private readonly favoritesFacade = inject(FavoritesFacade);

  async ngOnInit(): Promise<void> {
    await this.facade.initialize();
    void this.offersFacade.loadFeatured();
    void this.checkFavorites();
  }

  protected async retry(): Promise<void> {
    await this.facade.retry();
    void this.checkFavorites();
  }

  protected bannerImageUrl(imageUrl?: string): string | undefined {
    return this.mediaUrlService.resolve(imageUrl);
  }

  /** One bulk favorite-status request for every restaurant shown across every shelf — never one request per card. */
  private async checkFavorites(): Promise<void> {
    if (!this.authFacade.isAuthenticated()) {
      return;
    }

    const home = this.facade.home();
    if (!home) {
      return;
    }

    const ids = [
      ...home.featuredRestaurants,
      ...home.nearbyRestaurants,
      ...home.popularRestaurants,
      ...home.recommendedRestaurants,
    ].map((r) => r.id);

    await this.favoritesFacade.checkRestaurantFavorites(ids);
  }
}
