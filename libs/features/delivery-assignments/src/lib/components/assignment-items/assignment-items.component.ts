import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { AssignmentOrderItemSummaryDto } from '@patheya-express-frontend/api-sdk';

@Component({
  selector: 'lib-assignment-items',
  standalone: true,
  templateUrl: './assignment-items.component.html',
  styleUrl: './assignment-items.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentItemsComponent {
  @Input({ required: true }) items: AssignmentOrderItemSummaryDto[] = [];
}
