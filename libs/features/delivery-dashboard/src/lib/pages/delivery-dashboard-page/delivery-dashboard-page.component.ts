import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ErrorStateComponent, MetricCardComponent, SkeletonComponent, StatusChipComponent } from '@patheya-express-frontend/ui';
import { DeliveryVerificationFacade } from '@patheya-express-frontend/delivery-verification';
import { DeliveryComplianceFacade } from '@patheya-express-frontend/delivery-compliance';
import { DeliveryDashboardFacade } from '../../facades/delivery-dashboard.facade';

@Component({
  selector: 'lib-delivery-dashboard-page',
  standalone: true,
  imports: [RouterLink, TitleCasePipe, SkeletonComponent, ErrorStateComponent, MetricCardComponent, StatusChipComponent],
  templateUrl: './delivery-dashboard-page.component.html',
  styleUrl: './delivery-dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryDashboardPageComponent implements OnInit {
  private readonly facade = inject(DeliveryDashboardFacade);
  protected readonly verificationFacade = inject(DeliveryVerificationFacade);
  protected readonly complianceFacade = inject(DeliveryComplianceFacade);

  protected readonly partner = this.facade.partner;
  protected readonly isOnline = this.facade.isOnline;
  protected readonly currentAssignment = this.facade.currentAssignment;
  protected readonly metrics = this.facade.metrics;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly statusActionPending = this.facade.statusActionPending;

  /** Online Protection UI: the toggle/quick-actions only render once verification is APPROVED —
   *  not just disabled, hidden entirely. The backend already rejects goAvailable/presence-online
   *  requests regardless; this is purely UX (this route is also guarded, so in practice this only
   *  matters if the partner's stage changes to SUSPENDED while the dashboard is already open). */
  protected readonly isApproved = this.verificationFacade.isApproved;

  ngOnInit(): void {
    void this.facade.initialize();
    this.verificationFacade.initialize();
    this.complianceFacade.initialize();
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
