import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  CarouselComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  HorizontalShelfComponent,
  IconButtonComponent,
  InfiniteScrollDirective,
  NetworkStatusService,
  ProgressIndicatorComponent,
  PullToRefreshDirective,
  SearchBarComponent,
  SkeletonComponent,
  StatusChipComponent,
  ToastService,
  trackById,
} from '@patheya-express-frontend/ui';
import {
  RestaurantCardComponent,
  RestaurantSectionComponent,
  SearchSuggestionsService,
} from '@patheya-express-frontend/restaurant-discovery';
import type { RecentSearchDto } from '@patheya-express-frontend/api-sdk';
import { MediaUrlService } from '@patheya-express-frontend/core';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { FavoritesFacade } from '@patheya-express-frontend/favorites';
import { CustomerOffersFacade, OfferCarouselComponent } from '@patheya-express-frontend/customer-offers';
import { CustomerHomeFacade } from '../../facades/customer-home.facade';

@Component({
  selector: 'lib-customer-home-page',
  standalone: true,
  imports: [
    RouterLink,
    RestaurantCardComponent,
    RestaurantSectionComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    OfferCarouselComponent,
    CarouselComponent,
    HorizontalShelfComponent,
    SearchBarComponent,
    IconButtonComponent,
    StatusChipComponent,
    ProgressIndicatorComponent,
    PullToRefreshDirective,
    InfiniteScrollDirective,
  ],
  templateUrl: './customer-home-page.component.html',
  styleUrl: './customer-home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerHomePageComponent implements OnInit {
  protected readonly facade = inject(CustomerHomeFacade);
  protected readonly offersFacade = inject(CustomerOffersFacade);
  protected readonly networkStatus = inject(NetworkStatusService);
  private readonly mediaUrlService = inject(MediaUrlService);
  private readonly authFacade = inject(AuthFacade);
  private readonly favoritesFacade = inject(FavoritesFacade);
  private readonly searchSuggestionsService = inject(SearchSuggestionsService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly trackById = trackById;

  protected readonly searchValue = signal('');
  protected readonly recentSearches = signal<RecentSearchDto[]>([]);
  protected readonly errorTitle = computed(() =>
    this.networkStatus.isOffline() ? "You're offline" : 'Something went wrong',
  );

  constructor() {
    // "Open Now"/"Top Rated"/"Fast Delivery" load independently of — and later than — the main
    // home response (see CustomerHomeStore.loadShelves), so a single post-init favorite check
    // would miss whichever of the three hadn't resolved yet. Re-running on every change to any
    // of them (including the "More restaurants" infinite-scroll list) keeps every card's
    // favorite state correct without each shelf needing to know about the others.
    effect(() => {
      const ids = [
        ...this.facade.openNowRestaurants(),
        ...this.facade.topRatedRestaurants(),
        ...this.facade.fastDeliveryRestaurants(),
        ...this.facade.more().items,
      ].map((restaurant) => restaurant.id);

      if (this.authFacade.isAuthenticated() && ids.length > 0) {
        void this.favoritesFacade.checkRestaurantFavorites(ids);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.facade.initialize();
    void this.offersFacade.loadFeatured();
    void this.checkFavorites();
    void this.loadRecentSearches();
  }

  protected async retry(): Promise<void> {
    await this.facade.retry();
    void this.checkFavorites();
  }

  /** Bound to `PullToRefreshDirective` — `complete()` on the directive instance resets its
   *  indicator once this resolves, success or failure alike. */
  protected async onPullToRefresh(ptr: PullToRefreshDirective): Promise<void> {
    await this.retry();
    ptr.complete();
  }

  protected onLoadMore(): void {
    void this.facade.loadMoreRestaurants();
  }

  protected bannerImageUrl(imageUrl?: string): string | undefined {
    return this.mediaUrlService.resolve(imageUrl);
  }

  protected onSearchSubmit(): void {
    const value = this.searchValue().trim();
    if (!value) {
      return;
    }

    void this.searchSuggestionsService.logSearch(value);
    if (this.authFacade.isAuthenticated()) {
      void this.searchSuggestionsService.recordRecent(value);
    }

    void this.router.navigate(['/restaurants'], { queryParams: { search: value } });
  }

  protected selectRecentSearch(query: string): void {
    this.searchValue.set(query);
    this.onSearchSubmit();
  }

  /** Extension point: no speech-to-text integration exists yet (web has no consistent cross-
   *  browser API without a paid backend service; native would need a Capacitor plugin) — tapping
   *  this is honest about that instead of silently doing nothing. */
  protected onVoiceSearchTapped(): void {
    this.toastService.showToast({ message: 'Voice search is coming soon.', tone: 'neutral' });
  }

  private async loadRecentSearches(): Promise<void> {
    if (!this.authFacade.isAuthenticated()) {
      return;
    }

    this.recentSearches.set(await this.searchSuggestionsService.getRecent());
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
