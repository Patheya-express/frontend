import { Injectable, computed, inject, signal } from '@angular/core';
import type { AdminOrderResponseDto, OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { AdminOrdersService } from '../services/admin-orders.service';

export type OrderStatusFilter = AdminOrderResponseDto['status'];

export interface AdminOrdersFilters {
  search: string;
  status: OrderStatusFilter | null;
  restaurantId: string;
  dateFrom: string;
  dateTo: string;
}

export interface AdminOrdersPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminOrdersState {
  orders: AdminOrderResponseDto[];
  pagination: AdminOrdersPagination;
  filters: AdminOrdersFilters;
  selectedOrder: AdminOrderResponseDto | null;
}

const DEFAULT_PAGINATION: AdminOrdersPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
const DEFAULT_FILTERS: AdminOrdersFilters = { search: '', status: null, restaurantId: '', dateFrom: '', dateTo: '' };

@Injectable({ providedIn: 'root' })
export class AdminOrdersStore {
  private readonly adminOrdersService = inject(AdminOrdersService);

  private readonly _orders = signal<AdminOrderResponseDto[]>([]);
  private readonly _pagination = signal<AdminOrdersPagination>(DEFAULT_PAGINATION);
  private readonly _filters = signal<AdminOrdersFilters>(DEFAULT_FILTERS);
  private readonly _selectedOrder = signal<AdminOrderResponseDto | null>(null);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _processingId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly processingId = this._processingId.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly state = computed<AdminOrdersState>(() => ({
    orders: this._orders(),
    pagination: this._pagination(),
    filters: this._filters(),
    selectedOrder: this._selectedOrder(),
  }));

  async loadOrders(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const filters = this._filters();
      const pagination = this._pagination();

      const response = await this.adminOrdersService.getOrders({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search || undefined,
        status: filters.status ?? undefined,
        restaurantId: filters.restaurantId || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });

      this._orders.set(response.items);
      this._pagination.set({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: response.totalPages,
      });
    } catch {
      this._error.set('Unable to load orders. Please try again.');
      this._orders.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  setSearch(search: string): void {
    this._filters.update((filters) => ({ ...filters, search }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadOrders();
  }

  setStatusFilter(status: OrderStatusFilter | null): void {
    this._filters.update((filters) => ({ ...filters, status }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadOrders();
  }

  setRestaurantFilter(restaurantId: string): void {
    this._filters.update((filters) => ({ ...filters, restaurantId }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadOrders();
  }

  setDateRange(dateFrom: string, dateTo: string): void {
    this._filters.update((filters) => ({ ...filters, dateFrom, dateTo }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadOrders();
  }

  setPage(page: number): void {
    this._pagination.update((pagination) => ({ ...pagination, page }));
    void this.loadOrders();
  }

  selectOrder(order: AdminOrderResponseDto | null): void {
    this._selectedOrder.set(order);
  }

  cancelOrder(orderId: string, reason?: string): Promise<void> {
    return this.transitionOrder(
      orderId,
      (order) => ({ ...order, status: 'CANCELLED' }),
      (original) => this.adminOrdersService.cancelOrder(original.id, reason),
    );
  }

  forceCompleteOrder(orderId: string, reason?: string): Promise<void> {
    return this.transitionOrder(
      orderId,
      (order) => ({ ...order, status: 'DELIVERED' }),
      (original) => this.adminOrdersService.forceCompleteOrder(original.id, reason),
    );
  }

  refundOrder(orderId: string, reason?: string): Promise<void> {
    return this.transitionOrder(
      orderId,
      (order) => ({ ...order, paymentStatus: 'REFUNDED' }),
      (original) => this.adminOrdersService.refundOrder(original.id, reason),
    );
  }

  reassignDeliveryPartner(orderId: string, deliveryPartnerId: string): Promise<void> {
    return this.transitionOrder(
      orderId,
      // The new partner's name/phone aren't known client-side until the next load — clearing
      // the summary avoids showing a stale name attached to the newly-assigned partner ID.
      (order) => ({ ...order, deliveryPartnerId, deliveryPartner: undefined }),
      (original) => this.adminOrdersService.reassignDeliveryPartner(original.id, deliveryPartnerId),
    );
  }

  dismissActionError(): void {
    this._actionError.set(null);
  }

  /**
   * The single path every order action runs through — cancel, force-complete, refund, and
   * reassign — mirroring transitionUser()/transitionRestaurant(): optimistically apply the
   * change, then reconcile with the server response, or roll back to the original on failure.
   *
   * Action endpoints return a minimal OrderResponseDto that omits relations (customer,
   * restaurant, items, statusHistory) present on the admin list's AdminOrderResponseDto — only
   * status/paymentStatus/deliveryPartnerId/deliveredAt are taken from that response; every
   * other field, including updatedAt, keeps its already-loaded value (same approach as
   * restaurant-orders' transitionOrder for its own thinner action responses).
   */
  private async transitionOrder(
    orderId: string,
    applyOptimistic: (order: AdminOrderResponseDto) => AdminOrderResponseDto,
    action: (original: AdminOrderResponseDto) => Promise<OrderResponseDto>,
  ): Promise<void> {
    const original = this._orders().find((order) => order.id === orderId);
    if (!original) {
      return;
    }

    this._processingId.set(orderId);
    this.replaceOrder(orderId, applyOptimistic(original));

    try {
      const response = await action(original);
      const reconciled: AdminOrderResponseDto = {
        ...applyOptimistic(original),
        status: response.status,
        paymentStatus: response.paymentStatus,
        deliveryPartnerId: response.deliveryPartnerId,
        deliveredAt: response.deliveredAt,
      };

      this.replaceOrder(orderId, reconciled);

      if (this._selectedOrder()?.id === orderId) {
        this._selectedOrder.set(reconciled);
      }

      this._actionError.set(null);
    } catch {
      this.replaceOrder(orderId, original);
      this._actionError.set('Unable to update this order. Please try again.');
    } finally {
      this._processingId.set(null);
    }
  }

  private replaceOrder(orderId: string, replacement: AdminOrderResponseDto): void {
    this._orders.update((orders) => orders.map((order) => (order.id === orderId ? replacement : order)));
  }
}
