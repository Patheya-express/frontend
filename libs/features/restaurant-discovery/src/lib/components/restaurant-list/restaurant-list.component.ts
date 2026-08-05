import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { RecentSearchDto, SearchSuggestionDto, TrendingSearchDto } from '@patheya-express-frontend/api-sdk';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  ListStaggerDirective,
  MOBILE_LIST_ITEM_TRANSITION,
  NetworkStatusService,
  PaginationComponent,
  SearchInputComponent,
  SkeletonComponent,
} from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { FavoritesFacade } from '@patheya-express-frontend/favorites';
import { RestaurantFacade } from '../../facades/restaurant.facade';
import type { RestaurantFilters } from '../../store/restaurant.store';
import { RestaurantCardComponent } from '../restaurant-card/restaurant-card.component';
import { SearchSuggestionsService } from '../../services/search-suggestions.service';

@Component({
  selector: 'lib-restaurant-list',
  standalone: true,
  imports: [
    RestaurantCardComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SearchInputComponent,
    PaginationComponent,
    ListStaggerDirective,
  ],
  templateUrl: './restaurant-list.component.html',
  styleUrl: './restaurant-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantListComponent implements OnInit {
  protected readonly facade = inject(RestaurantFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authFacade = inject(AuthFacade);
  private readonly favoritesFacade = inject(FavoritesFacade);
  private readonly searchSuggestionsService = inject(SearchSuggestionsService);
  private readonly networkStatus = inject(NetworkStatusService);

  /** Matches the pattern already used on customer-home-page/restaurant-details-page, previously
   *  missing here — a failed fetch while offline showed the same generic message as a real
   *  server error. */
  protected readonly errorTitle = computed(() => (this.networkStatus.isOffline() ? "You're offline" : 'Something went wrong'));

  /** Staggered entrance for the results grid — see ListStaggerDirective/keyframes.scss. Read once
   *  into a plain property rather than referencing the imported constant directly in the template,
   *  matching how every other cross-cutting token is consumed in this codebase. */
  protected readonly listItemEnterClass = MOBILE_LIST_ITEM_TRANSITION.enter;

  protected readonly suggestions = signal<SearchSuggestionDto[]>([]);
  protected readonly recentSearches = signal<RecentSearchDto[]>([]);
  protected readonly trendingSearches = signal<TrendingSearchDto[]>([]);
  protected readonly showSuggestions = signal(false);

  private suggestionsRequestId = 0;

  constructor() {
    // One bulk favorite-status request per page of results — never one request per card.
    effect(() => {
      const restaurants = this.facade.restaurants();
      if (!this.authFacade.isAuthenticated() || restaurants.length === 0) {
        return;
      }
      void this.favoritesFacade.checkRestaurantFavorites(restaurants.map((r) => r.id));
    });
  }

  async ngOnInit(): Promise<void> {
    await this.facade.initialize();

    // Reads every filter/sort query param the app actually links here with (customer-home's
    // search submit, and its Trending/Open Now/Fast Delivery/Top Rated "see all" links) — not
    // just `cuisine`. Previously only `cuisine` was read, so arriving from any of those other
    // entry points silently landed on the full unfiltered list.
    const params = this.route.snapshot.queryParamMap;
    const partialFilters: Partial<RestaurantFilters> = {};

    const cuisine = params.get('cuisine');
    if (cuisine) {
      partialFilters.cuisine = cuisine;
    }
    const search = params.get('search');
    if (search) {
      partialFilters.search = search;
    }
    const openNow = params.get('openNow');
    if (openNow) {
      partialFilters.openNow = openNow === 'true';
    }
    const sortBy = params.get('sortBy') as RestaurantFilters['sortBy'] | null;
    if (sortBy) {
      partialFilters.sortBy = sortBy;
    }
    const sortOrder = params.get('sortOrder') as RestaurantFilters['sortOrder'] | null;
    if (sortOrder) {
      partialFilters.sortOrder = sortOrder;
    }

    if (Object.keys(partialFilters).length > 0) {
      this.facade.setFilters(partialFilters);
    }

    void this.searchSuggestionsService.getTrending().then((trending) => this.trendingSearches.set(trending));

    if (this.authFacade.isAuthenticated()) {
      void this.searchSuggestionsService.getRecent().then((recent) => this.recentSearches.set(recent));
    }
  }

  protected retry(): void {
    void this.facade.retry();
  }

  protected onSearch(value: string): void {
    this.facade.setSearch(value);

    if (!value.trim()) {
      this.suggestions.set([]);
      this.showSuggestions.set(false);
      return;
    }

    // Keystrokes can resolve out of order under variable network latency — only apply the
    // response for the most recently issued request.
    const requestId = ++this.suggestionsRequestId;
    void this.searchSuggestionsService.getSuggestions(value).then((results) => {
      if (requestId !== this.suggestionsRequestId) {
        return;
      }
      this.suggestions.set(results);
      this.showSuggestions.set(true);
    });

    void this.searchSuggestionsService.logSearch(value);

    if (this.authFacade.isAuthenticated()) {
      void this.searchSuggestionsService
        .recordRecent(value)
        .then(() => this.searchSuggestionsService.getRecent())
        .then((recent) => this.recentSearches.set(recent));
    }
  }

  protected onSearchFocus(): void {
    if (this.facade.filters().search.trim()) {
      this.showSuggestions.set(true);
    }
  }

  protected onSearchBlur(): void {
    // Delay so a click on a suggestion/chip registers before the panel hides.
    setTimeout(() => this.showSuggestions.set(false), 150);
  }

  protected selectSuggestion(suggestion: SearchSuggestionDto): void {
    this.showSuggestions.set(false);

    switch (suggestion.type) {
      case 'RESTAURANT':
        void this.router.navigate(['/restaurants', suggestion.id]);
        return;
      case 'MENU_ITEM':
        void this.router.navigate(['/restaurants', suggestion.restaurantId]);
        return;
      case 'CUISINE':
        this.facade.setCuisineFilter(suggestion.label);
        return;
    }
  }

  protected selectChip(query: string): void {
    this.showSuggestions.set(false);
    this.onSearch(query);
  }

  protected onCuisineFilterChange(value: string): void {
    this.facade.setCuisineFilter(value);
  }

  protected onOpenNowToggle(checked: boolean): void {
    this.facade.setOpenNowFilter(checked);
  }

  protected onVegToggle(checked: boolean): void {
    this.facade.setVegFilter(checked);
  }

  protected onVeganToggle(checked: boolean): void {
    this.facade.setVeganFilter(checked);
  }

  protected onOffersToggle(checked: boolean): void {
    this.facade.setOffersFilter(checked);
  }

  protected onCityChange(value: string): void {
    this.facade.setCityFilter(value);
  }

  protected onMinRatingChange(value: string): void {
    this.facade.setMinRating(value ? Number(value) : undefined);
  }

  protected onMaxDeliveryTimeChange(value: string): void {
    this.facade.setMaxDeliveryTimeMinutes(value ? Number(value) : undefined);
  }

  protected onSortChange(value: string): void {
    const [sortBy, sortOrder] = value.split(':') as [RestaurantFilters['sortBy'], RestaurantFilters['sortOrder']];
    this.facade.setSort(sortBy, sortOrder);
  }

  protected clearFilters(): void {
    this.facade.clearFilters();
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }
}
