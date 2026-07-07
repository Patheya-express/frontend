import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { OrderResponseDto, OrderStatusHistoryResponseDto } from '@patheya-express-frontend/api-sdk';

type TrackedStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'OUT_FOR_DELIVERY' | 'DELIVERED';

const TRACKED_SEQUENCE: readonly TrackedStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

const STEP_LABELS: Record<TrackedStatus, string> = {
  PENDING: 'Order placed',
  CONFIRMED: 'Accepted by restaurant',
  PREPARING: 'Preparing your food',
  READY_FOR_PICKUP: 'Ready for pickup',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
};

export interface TimelineStep {
  status: TrackedStatus;
  label: string;
  state: 'completed' | 'current' | 'upcoming';
  timestamp: string | null;
}

@Component({
  selector: 'lib-order-status-timeline',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './order-status-timeline.component.html',
  styleUrl: './order-status-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderStatusTimelineComponent {
  private readonly _currentStatus = signal<OrderResponseDto['status']>('PENDING');
  private readonly _statusHistory = signal<OrderStatusHistoryResponseDto[]>([]);

  @Input({ required: true })
  set currentStatus(value: OrderResponseDto['status']) {
    this._currentStatus.set(value);
  }
  get currentStatus(): OrderResponseDto['status'] {
    return this._currentStatus();
  }

  @Input()
  set statusHistory(value: OrderStatusHistoryResponseDto[] | undefined) {
    this._statusHistory.set(value ?? []);
  }
  get statusHistory(): OrderStatusHistoryResponseDto[] {
    return this._statusHistory();
  }

  protected readonly isCancelled = computed(() => this._currentStatus() === 'CANCELLED');

  protected readonly steps = computed<TimelineStep[]>(() => {
    const currentIndex = TRACKED_SEQUENCE.indexOf(this._currentStatus() as TrackedStatus);
    const history = this._statusHistory();

    return TRACKED_SEQUENCE.map((status, index) => ({
      status,
      label: STEP_LABELS[status],
      state: index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'upcoming',
      timestamp: history.find((entry) => entry.status === status)?.createdAt ?? null,
    }));
  });
}
