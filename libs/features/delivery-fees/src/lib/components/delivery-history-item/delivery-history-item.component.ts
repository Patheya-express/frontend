import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';

@Component({
  selector: 'lib-delivery-history-item',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './delivery-history-item.component.html',
  styleUrl: './delivery-history-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryHistoryItemComponent {
  @Input({ required: true }) order!: OrderResponseDto;
}
