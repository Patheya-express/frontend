import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ErrorStateComponent, MetricCardComponent, SkeletonComponent, StatusChipComponent } from '@patheya-express-frontend/ui';
import { RestaurantDashboardFacade } from '../../facades/restaurant-dashboard.facade';

@Component({
  selector: 'lib-restaurant-dashboard-page',
  standalone: true,
  imports: [RouterLink, SkeletonComponent, ErrorStateComponent, MetricCardComponent, StatusChipComponent],
  templateUrl: './restaurant-dashboard-page.component.html',
  styleUrl: './restaurant-dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantDashboardPageComponent implements OnInit, OnDestroy {
  private readonly facade = inject(RestaurantDashboardFacade);

  protected readonly metrics = this.facade.metrics;
  protected readonly topSellingItems = this.facade.topSellingItems;
  protected readonly peakHours = this.facade.peakHours;
  protected readonly recentOrders = this.facade.recentOrders;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly realtimeConnected = this.facade.realtimeConnected;

  ngOnInit(): void {
    this.facade.initialize();
  }

  ngOnDestroy(): void {
    this.facade.dispose();
  }

  protected retry(): void {
    void this.facade.refresh();
  }

  protected formatHour(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }
}
