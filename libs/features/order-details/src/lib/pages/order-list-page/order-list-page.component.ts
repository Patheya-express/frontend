import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import type { OrderResponseDto, OrderStatusHistoryResponseDto } from '@patheya-express-frontend/api-sdk';
import {
  DialogService,
  EmptyStateComponent,
  ErrorStateComponent,
  PaginationComponent,
  SearchInputComponent,
  SkeletonComponent,
  ToastService,
  confirmDialog,
} from '@patheya-express-frontend/ui';
import { CartFacade } from '@patheya-express-frontend/cart';
import { OrderListFacade } from '../../facades/order-list.facade';
import type { OrderStatusFilter } from '../../store/order-list.store';

const STATUS_OPTIONS: ReadonlyArray<{ value: OrderStatusFilter; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'READY_FOR_PICKUP', label: 'Ready for pickup' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

@Component({
  selector: 'lib-order-list-page',
  standalone: true,
  imports: [RouterLink, DatePipe, SkeletonComponent, EmptyStateComponent, ErrorStateComponent, SearchInputComponent, PaginationComponent],
  templateUrl: './order-list-page.component.html',
  styleUrl: './order-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderListPageComponent implements OnInit {
  private readonly facade = inject(OrderListFacade);
  private readonly router = inject(Router);
  private readonly cartFacade = inject(CartFacade);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);

  protected readonly orders = this.facade.orders;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly page = this.facade.page;
  protected readonly totalPages = this.facade.totalPages;
  protected readonly total = this.facade.total;
  protected readonly search = this.facade.search;
  protected readonly status = this.facade.status;
  protected readonly dateFrom = this.facade.dateFrom;
  protected readonly dateTo = this.facade.dateTo;
  protected readonly hasActiveFilters = this.facade.hasActiveFilters;
  protected readonly reorderingOrderId = this.facade.reorderingOrderId;
  protected readonly reorderMessage = signal<string | null>(null);

  protected readonly statusOptions = STATUS_OPTIONS;

  ngOnInit(): void {
    void this.facade.loadOrders();
  }

  protected retry(): void {
    void this.facade.loadOrders();
  }

  protected browseRestaurants(): void {
    void this.router.navigateByUrl('/');
  }

  protected placedAt(statusHistory: OrderStatusHistoryResponseDto[] | undefined): string | null {
    if (!statusHistory || statusHistory.length === 0) {
      return null;
    }
    return statusHistory.find((entry) => entry.status === 'PENDING')?.createdAt ?? statusHistory[0].createdAt;
  }

  protected formatStatus(status: string): string {
    return status.replace(/_/g, ' ');
  }

  protected onSearch(value: string): void {
    this.facade.setSearch(value);
  }

  protected onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as OrderStatusFilter;
    this.facade.setStatus(value);
  }

  protected onDateFromChange(event: Event): void {
    this.facade.setDateRange((event.target as HTMLInputElement).value, this.dateTo());
  }

  protected onDateToChange(event: Event): void {
    this.facade.setDateRange(this.dateFrom(), (event.target as HTMLInputElement).value);
  }

  protected clearFilters(): void {
    this.facade.clearFilters();
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected async reorder(order: OrderResponseDto): Promise<void> {
    this.reorderMessage.set(null);

    // CartFacade.tryAddItem() (which facade.reorder() calls per item) always replaces a
    // cross-restaurant cart without pausing — a deliberate choice for the single-item "add from
    // menu" flow it also serves (see its own doc comment), but wrong here: the *caller* (this
    // reorder action) is what needs to decide whether silently wiping an in-progress cart from a
    // different restaurant is acceptable, not the low-level add primitive.
    const cartRestaurantId = this.cartFacade.restaurantId();
    const hasDifferentRestaurantCart =
      !!cartRestaurantId && cartRestaurantId !== order.restaurantId && this.cartFacade.totalItems() > 0;

    if (hasDifferentRestaurantCart) {
      const confirmed = await confirmDialog(this.dialogService, {
        title: 'Replace your cart?',
        message: 'Your cart has items from a different restaurant. Reordering will clear it and start a new cart.',
        confirmLabel: 'Replace cart',
        cancelLabel: 'Cancel',
        tone: 'danger',
      });

      if (!confirmed) {
        return;
      }
    }

    const result = await this.facade.reorder(order);

    if (result.added === 0) {
      this.reorderMessage.set("None of this order's items are available right now.");
      return;
    }

    if (result.unavailable > 0) {
      // Distinguishes a partial reorder (some items skipped) from full success — previously both
      // silently navigated to /cart with no indication anything was missing, so a customer could
      // check out believing they got everything from the original order. A toast, not the
      // page-local reorderMessage signal below, since the navigation to /cart on the very next
      // line would otherwise make a same-page message disappear before it could ever be seen.
      this.toastService.showToast({
        message: `${result.unavailable} item${result.unavailable === 1 ? '' : 's'} from this order ${result.unavailable === 1 ? 'is' : 'are'} no longer available and were skipped.`,
        tone: 'neutral',
      });
    }

    await this.router.navigateByUrl('/cart');
  }
}
