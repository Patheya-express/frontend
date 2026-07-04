import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EmptyStateComponent, ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { RestaurantMenuFacade } from '../../facades/restaurant-menu.facade';
import { MenuCategoryComponent } from '../../components/menu-category/menu-category.component';

@Component({
  selector: 'lib-restaurant-details-page',
  standalone: true,
  imports: [SkeletonComponent, EmptyStateComponent, ErrorStateComponent, MenuCategoryComponent],
  templateUrl: './restaurant-details-page.component.html',
  styleUrl: './restaurant-details-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantDetailsPageComponent implements OnInit {
  private readonly facade = inject(RestaurantMenuFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly restaurant = this.facade.restaurant;
  protected readonly menu = this.facade.menu;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly isEmpty = this.facade.isEmpty;

  private restaurantId = '';

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
}
