import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  NetworkStatusService,
  PaginationComponent,
  SkeletonComponent,
} from '@patheya-express-frontend/ui';
import { MediaUrlService } from '@patheya-express-frontend/core';
import { FavoritesFacade } from '../../facades/favorites.facade';
import { FavoriteButtonComponent } from '../../components/favorite-button/favorite-button.component';

type FavoritesTab = 'restaurants' | 'dishes';

@Component({
  selector: 'lib-favorites-page',
  standalone: true,
  // Deliberately does not import RestaurantCardComponent from restaurant-discovery — that lib
  // imports FavoriteButtonComponent from here, and the reverse import would create a circular
  // dependency (favorites -> restaurant-discovery -> favorites). This renders its own compact
  // restaurant row instead.
  imports: [RouterLink, FavoriteButtonComponent, SkeletonComponent, EmptyStateComponent, ErrorStateComponent, PaginationComponent],
  templateUrl: './favorites-page.component.html',
  styleUrl: './favorites-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoritesPageComponent implements OnInit {
  protected readonly facade = inject(FavoritesFacade);
  private readonly mediaUrlService = inject(MediaUrlService);
  private readonly networkStatus = inject(NetworkStatusService);

  protected readonly tab = signal<FavoritesTab>('restaurants');

  /** Shared by both tabs' error-state usages — same title logic (offline vs generic) applies
   *  regardless of which fetch failed. Matches the pattern already used on customer-home-page
   *  and restaurant-details-page, previously missing here. */
  protected readonly errorTitle = computed(() => (this.networkStatus.isOffline() ? "You're offline" : 'Something went wrong'));

  ngOnInit(): void {
    void this.facade.loadFavoriteRestaurants();
    void this.facade.loadFavoriteMenuItems();
  }

  protected setTab(tab: FavoritesTab): void {
    this.tab.set(tab);
  }

  protected retryRestaurants(): void {
    void this.facade.loadFavoriteRestaurants(this.facade.restaurantsPage());
  }

  protected retryDishes(): void {
    void this.facade.loadFavoriteMenuItems(this.facade.menuItemsPage());
  }

  protected onRestaurantsPageChange(page: number): void {
    void this.facade.loadFavoriteRestaurants(page);
  }

  protected onDishesPageChange(page: number): void {
    void this.facade.loadFavoriteMenuItems(page);
  }

  protected imageUrl(url?: string): string | undefined {
    return this.mediaUrlService.resolve(url);
  }
}
