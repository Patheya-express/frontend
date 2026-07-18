import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { EmptyStateComponent, ErrorStateComponent, SkeletonComponent, StatusChipComponent } from '@patheya-express-frontend/ui';
import { RestaurantOrdersFacade } from '../../facades/restaurant-orders.facade';
import { RESTAURANT_ORDER_FILTERS, RestaurantOrderFilter } from '../../store/restaurant-orders.store';
import { OrderCardComponent } from '../../components/order-card/order-card.component';

@Component({
  selector: 'lib-restaurant-orders-page',
  standalone: true,
  imports: [SkeletonComponent, EmptyStateComponent, ErrorStateComponent, OrderCardComponent, StatusChipComponent],
  templateUrl: './restaurant-orders-page.component.html',
  styleUrl: './restaurant-orders-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantOrdersPageComponent implements OnInit, OnDestroy {
  private readonly facade = inject(RestaurantOrdersFacade);

  protected readonly filters = RESTAURANT_ORDER_FILTERS;
  protected readonly orders = this.facade.orders;
  protected readonly selectedFilter = this.facade.selectedFilter;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly actionError = this.facade.actionError;
  protected readonly realtimeConnected = this.facade.realtimeConnected;

  ngOnInit(): void {
    this.facade.initialize();
  }

  ngOnDestroy(): void {
    this.facade.dispose();
  }

  protected selectFilter(filter: RestaurantOrderFilter): void {
    this.facade.setFilter(filter);
  }

  protected retry(): void {
    void this.facade.refresh();
  }

  protected dismissActionError(): void {
    this.facade.dismissActionError();
  }
}
