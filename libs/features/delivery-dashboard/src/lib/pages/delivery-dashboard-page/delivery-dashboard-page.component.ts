import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ErrorStateComponent, MetricCardComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { DeliveryDashboardFacade } from '../../facades/delivery-dashboard.facade';

@Component({
  selector: 'lib-delivery-dashboard-page',
  standalone: true,
  imports: [RouterLink, TitleCasePipe, SkeletonComponent, ErrorStateComponent, MetricCardComponent],
  templateUrl: './delivery-dashboard-page.component.html',
  styleUrl: './delivery-dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryDashboardPageComponent implements OnInit {
  private readonly facade = inject(DeliveryDashboardFacade);

  protected readonly partner = this.facade.partner;
  protected readonly isOnline = this.facade.isOnline;
  protected readonly currentAssignment = this.facade.currentAssignment;
  protected readonly metrics = this.facade.metrics;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly statusActionPending = this.facade.statusActionPending;

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected retry(): void {
    void this.facade.refresh();
  }

  protected toggleOnline(): void {
    if (this.statusActionPending()) {
      return;
    }
    void (this.isOnline() ? this.facade.goOffline() : this.facade.goOnline());
  }
}
