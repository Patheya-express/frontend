import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { EmptyStateComponent, ErrorStateComponent, MetricCardComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { DeliveryFeesFacade } from '../../facades/delivery-fees.facade';
import { DeliveryHistoryItemComponent } from '../../components/delivery-history-item/delivery-history-item.component';

@Component({
  selector: 'lib-delivery-fees-page',
  standalone: true,
  imports: [SkeletonComponent, ErrorStateComponent, EmptyStateComponent, MetricCardComponent, DeliveryHistoryItemComponent],
  templateUrl: './delivery-fees-page.component.html',
  styleUrl: './delivery-fees-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryFeesPageComponent implements OnInit {
  private readonly facade = inject(DeliveryFeesFacade);

  protected readonly state = this.facade.state;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected retry(): void {
    void this.facade.refresh();
  }
}
