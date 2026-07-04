import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { EmptyStateComponent, ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { RestaurantFacade } from '../../facades/restaurant.facade';
import { RestaurantCardComponent } from '../restaurant-card/restaurant-card.component';

@Component({
  selector: 'lib-restaurant-list',
  standalone: true,
  imports: [RestaurantCardComponent, SkeletonComponent, EmptyStateComponent, ErrorStateComponent],
  templateUrl: './restaurant-list.component.html',
  styleUrl: './restaurant-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantListComponent implements OnInit {
  protected readonly facade = inject(RestaurantFacade);

  ngOnInit(): void {
    void this.facade.loadRestaurants();
  }

  protected retry(): void {
    void this.facade.loadRestaurants();
  }
}
