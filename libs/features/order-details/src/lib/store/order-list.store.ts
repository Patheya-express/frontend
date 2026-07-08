import { Injectable, computed, inject, signal } from '@angular/core';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { CartFacade } from '@patheya-express-frontend/cart';
import { OrderDetailsService } from '../services/order-details.service';

const PAGE_SIZE = 10;

export type OrderStatusFilter = OrderResponseDto['status'] | '';

export interface ReorderResult {
  added: number;
  unavailable: number;
}

@Injectable({ providedIn: 'root' })
export class OrderListStore {
  private readonly orderDetailsService = inject(OrderDetailsService);
  private readonly cartFacade = inject(CartFacade);

  private readonly _orders = signal<OrderResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private readonly _page = signal(1);
  private readonly _totalPages = signal(1);
  private readonly _total = signal(0);

  private readonly _search = signal('');
  private readonly _status = signal<OrderStatusFilter>('');
  private readonly _dateFrom = signal('');
  private readonly _dateTo = signal('');

  private readonly _reorderingOrderId = signal<string | null>(null);

  readonly orders = this._orders.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly page = this._page.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly total = this._total.asReadonly();
  readonly search = this._search.asReadonly();
  readonly status = this._status.asReadonly();
  readonly dateFrom = this._dateFrom.asReadonly();
  readonly dateTo = this._dateTo.asReadonly();
  readonly reorderingOrderId = this._reorderingOrderId.asReadonly();

  readonly hasActiveFilters = computed(
    () => this._search().length > 0 || this._status() !== '' || this._dateFrom() !== '' || this._dateTo() !== '',
  );

  async loadOrders(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const result = await this.orderDetailsService.getCustomerOrders({
        page: this._page(),
        limit: PAGE_SIZE,
        search: this._search().trim() || undefined,
        status: this._status() || undefined,
        dateFrom: this._dateFrom() || undefined,
        dateTo: this._dateTo() || undefined,
      });

      this._orders.set(result.items);
      this._total.set(result.total);
      this._totalPages.set(Math.max(1, result.totalPages));
    } catch {
      this._error.set('Unable to load your orders. Please try again.');
      this._orders.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  setSearch(value: string): void {
    this._search.set(value);
    this._page.set(1);
    void this.loadOrders();
  }

  setStatus(value: OrderStatusFilter): void {
    this._status.set(value);
    this._page.set(1);
    void this.loadOrders();
  }

  setDateRange(dateFrom: string, dateTo: string): void {
    this._dateFrom.set(dateFrom);
    this._dateTo.set(dateTo);
    this._page.set(1);
    void this.loadOrders();
  }

  clearFilters(): void {
    this._search.set('');
    this._status.set('');
    this._dateFrom.set('');
    this._dateTo.set('');
    this._page.set(1);
    void this.loadOrders();
  }

  setPage(page: number): void {
    this._page.set(page);
    void this.loadOrders();
  }

  /**
   * Re-adds every item from a past order to the current cart, using the same Cart API item
   * availability/variant/addon validation as adding from the menu — items that are no longer
   * available (or whose variant/addon selection no longer exists) are simply skipped and
   * reported back, rather than failing the whole reorder.
   */
  async reorder(order: OrderResponseDto): Promise<ReorderResult> {
    this._reorderingOrderId.set(order.id);

    let added = 0;
    let unavailable = 0;

    try {
      for (const item of order.items) {
        const success = await this.cartFacade.tryAddItem({
          menuItemId: item.menuItemId,
          variantId: item.variantId,
          addonOptionIds: item.addonOptions.map((option) => option.addonOptionId),
          quantity: item.quantity,
          specialInstructions: item.specialInstructions,
          restaurantName: '',
        });

        if (success) {
          added++;
        } else {
          unavailable++;
        }
      }
    } finally {
      this._reorderingOrderId.set(null);
    }

    return { added, unavailable };
  }
}
