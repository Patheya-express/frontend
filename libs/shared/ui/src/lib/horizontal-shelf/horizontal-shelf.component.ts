import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/**
 * Generic titled horizontal-scrolling shelf: heading, optional "See all" link, and a
 * horizontally-scrolling row of content-projected items — with a built-in loading skeleton so
 * every shelf-shaped section (restaurant rows, cuisine/category chips, anything else that's "a
 * titled row of cards") gets the same scroll/skeleton/empty mechanics instead of each screen
 * reimplementing them. Domain-aware sections compose this rather than duplicating it — see
 * `RestaurantSectionComponent` (`@patheya-express-frontend/restaurant-discovery`), which wraps
 * this specifically for `RestaurantSummaryDto` shelves.
 *
 * @example
 * <lib-horizontal-shelf title="Popular Right Now" [loading]="loading()">
 *   @for (restaurant of restaurants(); track restaurant.id) {
 *     <lib-restaurant-card [restaurant]="restaurant" />
 *   }
 * </lib-horizontal-shelf>
 */
@Component({
  selector: 'lib-horizontal-shelf',
  standalone: true,
  imports: [RouterLink, SkeletonComponent],
  templateUrl: './horizontal-shelf.component.html',
  styleUrl: './horizontal-shelf.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HorizontalShelfComponent {
  readonly title = input<string | undefined>(undefined);
  readonly seeAllPath = input<string | undefined>(undefined);
  readonly seeAllQueryParams = input<Record<string, unknown> | undefined>(undefined);
  readonly seeAllLabel = input('See all');
  readonly loading = input(false);
  readonly skeletonCount = input(4);
  /** Matches the projected items' own width so the loading skeleton doesn't visibly reflow once
   *  real content arrives. */
  readonly skeletonItemWidth = input('220px');
  readonly skeletonItemHeight = input('96px');

  protected readonly skeletonPlaceholders = computed(() =>
    Array.from({ length: this.skeletonCount() }, (_, index) => index),
  );
}
