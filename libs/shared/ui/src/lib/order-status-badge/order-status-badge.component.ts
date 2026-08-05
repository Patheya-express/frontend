import { ChangeDetectionStrategy, Component, Input, OnDestroy, computed, effect, signal } from '@angular/core';
import { MOBILE_MOTION_DURATIONS_MS } from '../tokens/motion.tokens';

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
export class OrderStatusBadgeComponent implements OnDestroy {
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

  /** Brief pop when the order actually advances to a new status — not on the badge's first
   *  render, so a page that simply loads an order already `OUT_FOR_DELIVERY` doesn't pop. */
  protected readonly justChanged = signal(false);
  private previousStatus: string | null = null;
  private popTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const current = this._status();
      if (this.previousStatus !== null && current !== this.previousStatus) {
        this.triggerPop();
      }
      this.previousStatus = current;
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.popTimeout);
  }

  private triggerPop(): void {
    clearTimeout(this.popTimeout);
    this.justChanged.set(false);
    requestAnimationFrame(() => requestAnimationFrame(() => this.justChanged.set(true)));
    this.popTimeout = setTimeout(() => this.justChanged.set(false), MOBILE_MOTION_DURATIONS_MS.base);
  }

  private toFallbackLabel(status: string): string {
    return status
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
