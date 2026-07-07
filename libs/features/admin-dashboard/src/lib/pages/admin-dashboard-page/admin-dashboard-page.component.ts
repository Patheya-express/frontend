import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent, ErrorStateComponent, MetricCardComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { AdminDashboardFacade } from '../../facades/admin-dashboard.facade';

const HEALTH_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  unknown: 'Unknown',
};

@Component({
  selector: 'lib-admin-dashboard-page',
  standalone: true,
  imports: [RouterLink, SkeletonComponent, ErrorStateComponent, EmptyStateComponent, MetricCardComponent],
  templateUrl: './admin-dashboard-page.component.html',
  styleUrl: './admin-dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPageComponent implements OnInit {
  private readonly facade = inject(AdminDashboardFacade);

  protected readonly state = this.facade.state;
  protected readonly alerts = this.facade.alerts;
  protected readonly notifications = this.facade.notifications;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;

  protected get healthLabel(): string {
    return HEALTH_LABELS[this.state().health.status];
  }

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected retry(): void {
    void this.facade.refresh();
  }
}
