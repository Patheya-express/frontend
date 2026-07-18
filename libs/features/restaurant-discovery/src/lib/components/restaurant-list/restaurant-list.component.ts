import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { RecentSearchDto, SearchSuggestionDto, TrendingSearchDto } from '@patheya-express-frontend/api-sdk';
import {
  EmptyStateComponent,
  ErrorStateComponent,
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

  protected readonly suggestions = signal<SearchSuggestionDto[]>([]);
  protected readonly recentSearches = signal<RecentSearchDto[]>([]);
  protected readonly trendingSearches = signal<TrendingSearchDto[]>([]);
  protected readonly showSuggestions = signal(false);

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

    const cuisine = this.route.snapshot.queryParamMap.get('cuisine');
    if (cuisine) {
      this.facade.setCuisineFilter(cuisine);
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

    void this.searchSuggestionsService.getSuggestions(value).then((results) => {
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
