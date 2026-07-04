import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ErrorStateComponent, MetricCardComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { RestaurantDashboardFacade } from '../../facades/restaurant-dashboard.facade';

@Component({
  selector: 'lib-restaurant-dashboard-page',
  standalone: true,
  imports: [RouterLink, SkeletonComponent, ErrorStateComponent, MetricCardComponent],
  templateUrl: './restaurant-dashboard-page.component.html',
  styleUrl: './restaurant-dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantDashboardPageComponent implements OnInit {
  private readonly facade = inject(RestaurantDashboardFacade);

  protected readonly metrics = this.facade.metrics;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected retry(): void {
    void this.facade.refresh();
  }
}
