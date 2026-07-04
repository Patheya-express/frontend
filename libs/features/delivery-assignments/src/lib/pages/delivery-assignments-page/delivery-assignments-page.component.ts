import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { EmptyStateComponent, ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { DeliveryAssignmentsFacade } from '../../facades/delivery-assignments.facade';
import { AssignmentCardComponent } from '../../components/assignment-card/assignment-card.component';

@Component({
  selector: 'lib-delivery-assignments-page',
  standalone: true,
  imports: [SkeletonComponent, EmptyStateComponent, ErrorStateComponent, AssignmentCardComponent],
  templateUrl: './delivery-assignments-page.component.html',
  styleUrl: './delivery-assignments-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryAssignmentsPageComponent implements OnInit, OnDestroy {
  private readonly facade = inject(DeliveryAssignmentsFacade);

  protected readonly groups = this.facade.groups;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly actionError = this.facade.actionError;

  ngOnInit(): void {
    this.facade.initialize();
  }

  ngOnDestroy(): void {
    this.facade.dispose();
  }

  protected retry(): void {
    void this.facade.refresh();
  }

  protected dismissActionError(): void {
    this.facade.dismissActionError();
  }
}
