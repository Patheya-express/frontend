import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'lib-cart-badge',
  standalone: true,
  templateUrl: './cart-badge.component.html',
  styleUrl: './cart-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartBadgeComponent {
  @Input() count = 0;
  @Output() activated = new EventEmitter<void>();
}
