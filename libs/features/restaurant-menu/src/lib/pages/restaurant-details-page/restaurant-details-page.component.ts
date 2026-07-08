import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EmptyStateComponent, ErrorStateComponent, SearchInputComponent, SkeletonComponent, StarRatingComponent } from '@patheya-express-frontend/ui';
import { MediaUrlService } from '@patheya-express-frontend/core';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { FavoriteButtonComponent, FavoritesFacade } from '@patheya-express-frontend/favorites';
import { OfferCardComponent } from '@patheya-express-frontend/customer-offers';
import { RestaurantMenuFacade } from '../../facades/restaurant-menu.facade';
import { MenuCategoryComponent } from '../../components/menu-category/menu-category.component';
import { RestaurantReviewsSectionComponent } from '../../components/restaurant-reviews-section/restaurant-reviews-section.component';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Component({
  selector: 'lib-restaurant-details-page',
  standalone: true,
  imports: [
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SearchInputComponent,
    StarRatingComponent,
    MenuCategoryComponent,
    RestaurantReviewsSectionComponent,
    FavoriteButtonComponent,
    OfferCardComponent,
  ],
  templateUrl: './restaurant-details-page.component.html',
  styleUrl: './restaurant-details-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantDetailsPageComponent implements OnInit {
  private readonly facade = inject(RestaurantMenuFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mediaUrlService = inject(MediaUrlService);
  private readonly authFacade = inject(AuthFacade);
  private readonly favoritesFacade = inject(FavoritesFacade);

  protected readonly isAuthenticated = this.authFacade.isAuthenticated;
  protected readonly restaurant = this.facade.restaurant;
  protected readonly menu = this.facade.menu;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly isEmpty = this.facade.isEmpty;
  protected readonly search = this.facade.search;

  private restaurantId = '';

  constructor() {
    // One bulk favorite-status request for the restaurant and one for every dish on the page —
    // never one request per card.
    effect(() => {
      const restaurant = this.restaurant();
      if (this.authFacade.isAuthenticated() && restaurant) {
        void this.favoritesFacade.checkRestaurantFavorites([restaurant.id]);
      }
    });

    effect(() => {
      const categories = this.menu();
      if (!this.authFacade.isAuthenticated() || categories.length === 0) {
        return;
      }
      const itemIds = categories.flatMap((category) => category.menuItems.map((item) => item.id));
      void this.favoritesFacade.checkMenuItemFavorites(itemIds);
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('restaurantId');
      if (id) {
        this.restaurantId = id;
        void this.facade.loadRestaurantMenu(id);
      }
    });
  }

  protected retry(): void {
    if (this.restaurantId) {
      void this.facade.loadRestaurantMenu(this.restaurantId);
    }
  }

  protected onSearch(query: string): void {
    void this.facade.searchMenu(query);
  }

  protected coverImageUrl(bannerUrl?: string, logoUrl?: string): string | undefined {
    return this.mediaUrlService.resolve(bannerUrl ?? logoUrl);
  }

  protected formatOperatingHours(dayOfWeek: number, opensAt: string, closesAt: string, isClosed: boolean): string {
    const day = DAY_NAMES[dayOfWeek] ?? '';
    return isClosed ? `${day}: Closed` : `${day}: ${opensAt} - ${closesAt}`;
  }
}
