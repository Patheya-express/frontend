import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Accepted',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_TONES: Record<string, string> = {
  PENDING: 'neutral',
  CONFIRMED: 'info',
  PREPARING: 'info',
  READY_FOR_PICKUP: 'success',
  OUT_FOR_DELIVERY: 'success',
  DELIVERED: 'success',
  CANCELLED: 'error',
};

@Component({
  selector: 'lib-order-status-badge',
  standalone: true,
  templateUrl: './order-status-badge.component.html',
  styleUrl: './order-status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderStatusBadgeComponent {
  private readonly _status = signal('');

  @Input({ required: true })
  set status(value: string) {
    this._status.set(value ?? '');
  }
  get status(): string {
    return this._status();
  }

  protected readonly label = computed(
    () => STATUS_LABELS[this._status()] ?? this.toFallbackLabel(this._status()),
  );
  protected readonly tone = computed(() => STATUS_TONES[this._status()] ?? 'neutral');

  private toFallbackLabel(status: string): string {
    return status
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
