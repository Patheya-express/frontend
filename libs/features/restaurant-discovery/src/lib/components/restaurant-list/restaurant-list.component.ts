import { ChangeDetectionStrategy, Component, OnInit, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
  private readonly authFacade = inject(AuthFacade);
  private readonly favoritesFacade = inject(FavoritesFacade);

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
  }

  protected retry(): void {
    void this.facade.retry();
  }

  protected onSearch(value: string): void {
    this.facade.setSearch(value);
  }

  protected onCuisineFilterChange(value: string): void {
    this.facade.setCuisineFilter(value);
  }

  protected onOpenNowToggle(checked: boolean): void {
    this.facade.setOpenNowFilter(checked);
  }

  protected onSortChange(value: string): void {
    const [sortBy, sortOrder] = value.split(':') as [RestaurantFilters['sortBy'], RestaurantFilters['sortOrder']];
    this.facade.setSort(sortBy, sortOrder);
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }
}
