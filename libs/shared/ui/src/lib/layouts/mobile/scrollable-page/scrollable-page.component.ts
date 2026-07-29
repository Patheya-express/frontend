import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { PullToRefreshDirective } from '../../../directives/pull-to-refresh.directive';
import { InfiniteScrollDirective } from '../../../directives/infinite-scroll.directive';
import { ProgressIndicatorComponent } from '../../../progress-indicator/progress-indicator.component';

/**
 * Scrollable content region wiring up `PullToRefreshDirective` + `InfiniteScrollDirective` and
 * rendering the pull indicator — the standard "list screen" scroll container. Both behaviors are
 * opt-in via outputs; if a screen never emits from `refresh`/`reachedEnd`, the directives are
 * just inert event listeners with no visible effect.
 *
 * @example
 * <mobile-scrollable-page (refresh)="reload()" (reachedEnd)="loadMore()">
 *   @for (order of orders(); track trackById(order)) { <mobile-order-card [order]="order" /> }
 * </mobile-scrollable-page>
 */
@Component({
  selector: 'mobile-scrollable-page',
  standalone: true,
  imports: [PullToRefreshDirective, InfiniteScrollDirective, ProgressIndicatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="mobile-scrollable-page__pull-indicator"
      [style.height.px]="pullToRefresh.pullDistance()"
    >
      @if (pullToRefresh.pullState() !== 'idle') {
        <lib-progress-indicator variant="circular" ariaLabel="Refreshing" />
      }
    </div>
    <div
      class="mobile-scrollable-page__scroller"
      mobilePullToRefresh
      #pullToRefresh="mobilePullToRefresh"
      (refresh)="refresh.emit()"
      mobileInfiniteScroll
      (reachedEnd)="reachedEnd.emit()"
    >
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      flex: 1;
    }

    .mobile-scrollable-page__pull-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      transition: height var(--transition-fast);
    }

    .mobile-scrollable-page__scroller {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
  `,
})
export class ScrollablePageComponent {
  readonly refresh = output<void>();
  readonly reachedEnd = output<void>();
}
