import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  AssignmentOrderSummaryDto,
  DeliveryAssignmentResponseDto,
  DeliveryPartnerResponseDto,
  OrderResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { DeliveryDashboardService } from '../services/delivery-dashboard.service';

export interface DashboardMetric {
  key: string;
  label: string;
  value: string;
}

const ACTIVE_ORDER_STATUSES: ReadonlyArray<OrderResponseDto['status']> = ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'];

function isToday(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  );
}

function buildMetrics(orders: OrderResponseDto[], pendingAssignmentsCount: number): DashboardMetric[] {
  const deliveredToday = orders.filter(
    (order) => order.status === 'DELIVERED' && !!order.deliveredAt && isToday(order.deliveredAt),
  );
  const feesToday = deliveredToday.reduce((sum, order) => sum + Number(order.deliveryFee), 0);

  return [
    { key: 'availableAssignments', label: 'Available Assignments', value: String(pendingAssignmentsCount) },
    { key: 'completedToday', label: 'Completed Deliveries Today', value: String(deliveredToday.length) },
    // Sum of delivery fees, not a final payout — no commission/earnings model exists yet.
    { key: 'feesToday', label: 'Delivery Fees Today (Estimated)', value: `₹${feesToday.toFixed(2)}` },
  ];
}

@Injectable({ providedIn: 'root' })
export class DeliveryDashboardStore {
  private readonly dashboardService = inject(DeliveryDashboardService);

  private readonly _partner = signal<DeliveryPartnerResponseDto | null>(null);
  private readonly _orders = signal<OrderResponseDto[]>([]);
  private readonly _assignments = signal<DeliveryAssignmentResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _statusActionPending = signal(false);

  readonly partner = this._partner.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly statusActionPending = this._statusActionPending.asReadonly();

  readonly isOnline = computed(() => this._partner()?.status === 'AVAILABLE');

  private readonly pendingAssignmentsCount = computed(
    () => this._assignments().filter((assignment) => assignment.status === 'PENDING').length,
  );

  /** The accepted assignment whose order hasn't reached a terminal state yet, if any. */
  readonly currentAssignment = computed<AssignmentOrderSummaryDto | null>(() => {
    const active = this._assignments().find(
      (assignment) =>
        assignment.status === 'ACCEPTED' &&
        !!assignment.order &&
        ACTIVE_ORDER_STATUSES.includes(assignment.order.status),
    );
    return active?.order ?? null;
  });

  readonly metrics = computed(() => buildMetrics(this._orders(), this.pendingAssignmentsCount()));

  async loadDashboard(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const [partner, orders, assignments] = await Promise.all([
        this.dashboardService.getPartner(),
        this.dashboardService.getAssignedOrders(),
        this.dashboardService.getMyAssignments(),
      ]);

      this._partner.set(partner);
      this._orders.set(orders);
      this._assignments.set(assignments);
    } catch {
      this._error.set('Unable to load your dashboard. Make sure you have completed delivery partner registration.');
    } finally {
      this._loading.set(false);
    }
  }

  goOnline(): Promise<void> {
    return this.toggleStatus(() => this.dashboardService.goOnline());
  }

  goOffline(): Promise<void> {
    return this.toggleStatus(() => this.dashboardService.goOffline());
  }

  private async toggleStatus(action: () => Promise<DeliveryPartnerResponseDto>): Promise<void> {
    this._statusActionPending.set(true);
    this._error.set(null);

    try {
      const partner = await action();
      this._partner.set(partner);
    } catch {
      this._error.set('Unable to update your status. Please try again.');
    } finally {
      this._statusActionPending.set(false);
    }
  }
}
