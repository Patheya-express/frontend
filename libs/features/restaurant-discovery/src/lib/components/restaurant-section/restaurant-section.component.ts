import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HorizontalShelfComponent, trackById } from '@patheya-express-frontend/ui';
import type { RestaurantSummaryDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantCardComponent } from '../restaurant-card/restaurant-card.component';

/**
 * The ONE reusable "titled row of restaurants" component. Every restaurant shelf on the customer
 * home page — Featured, Popular, Nearby, Recommended, Open Now, Fast Delivery, Top Rated — renders
 * through this single component, differing only in the `title`/`restaurants`/`loading`/
 * `seeAllPath` inputs passed to it; there is no per-section component to keep in sync. Composes
 * `HorizontalShelfComponent` (`@patheya-express-frontend/ui`) for the generic scroll/skeleton
 * mechanics and this library's own `RestaurantCardComponent` for each card — reimplements neither.
 *
 * @example
 * <lib-restaurant-section
 *   title="Open Now"
 *   [restaurants]="openNowRestaurants()"
 *   [loading]="loadingOpenNow()"
 *   seeAllPath="/restaurants"
 *   [seeAllQueryParams]="{ openNow: true }"
 * />
 */
@Component({
  selector: 'lib-restaurant-section',
  standalone: true,
  imports: [HorizontalShelfComponent, RestaurantCardComponent],
  templateUrl: './restaurant-section.component.html',
  styleUrl: './restaurant-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantSectionComponent {
  readonly title = input.required<string>();
  readonly restaurants = input<RestaurantSummaryDto[]>([]);
  readonly loading = input(false);
  readonly seeAllPath = input<string | undefined>(undefined);
  readonly seeAllQueryParams = input<Record<string, unknown> | undefined>(undefined);

  protected readonly trackById = trackById;
}
