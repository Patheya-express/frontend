import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'lib-notification-badge',
  standalone: true,
  templateUrl: './notification-badge.component.html',
  styleUrl: './notification-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBadgeComponent {
  @Input() count = 0;
  @Output() activated = new EventEmitter<void>();
}
