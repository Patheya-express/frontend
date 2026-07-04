import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { OrderItemResponseDto } from '@patheya-express-frontend/api-sdk';

@Component({
  selector: 'lib-order-items',
  standalone: true,
  templateUrl: './order-items.component.html',
  styleUrl: './order-items.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderItemsComponent {
  @Input({ required: true }) items: OrderItemResponseDto[] = [];
}
