import { Injectable, computed, inject, signal } from '@angular/core';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { DeliveryFeesService } from '../services/delivery-fees.service';

export interface DeliveryFeesMetrics {
  todayFees: number;
  completedTodayCount: number;
}

export interface DeliveryFeesState {
  metrics: DeliveryFeesMetrics;
  history: OrderResponseDto[];
}

function isToday(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  );
}

/** Delivered orders only, most recently delivered first. Deliberately uses `deliveredAt`, never `createdAt`. */
function buildHistory(orders: OrderResponseDto[]): OrderResponseDto[] {
  return orders
    .filter((order) => order.status === 'DELIVERED' && !!order.deliveredAt)
    .sort((a, b) => new Date(b.deliveredAt as string).getTime() - new Date(a.deliveredAt as string).getTime());
}

function buildMetrics(history: OrderResponseDto[]): DeliveryFeesMetrics {
  const deliveredToday = history.filter((order) => isToday(order.deliveredAt as string));
  return {
    todayFees: deliveredToday.reduce((sum, order) => sum + Number(order.deliveryFee), 0),
    completedTodayCount: deliveredToday.length,
  };
}

@Injectable({ providedIn: 'root' })
export class DeliveryFeesStore {
  private readonly feesService = inject(DeliveryFeesService);

  private readonly _orders = signal<OrderResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Single prepared state object — history is already filtered and sorted here, not in the component. */
  readonly state = computed<DeliveryFeesState>(() => {
    const history = buildHistory(this._orders());
    return { metrics: buildMetrics(history), history };
  });

  async loadHistory(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const orders = await this.feesService.getDeliveryHistory();
      this._orders.set(orders);
    } catch {
      this._error.set('Unable to load your delivery fees. Please try again.');
      this._orders.set([]);
    } finally {
      this._loading.set(false);
    }
  }
}
