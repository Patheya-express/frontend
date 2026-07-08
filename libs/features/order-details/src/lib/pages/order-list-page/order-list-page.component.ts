import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import type { OrderResponseDto, OrderStatusHistoryResponseDto } from '@patheya-express-frontend/api-sdk';
import { EmptyStateComponent, ErrorStateComponent, PaginationComponent, SearchInputComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
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

    const result = await this.facade.reorder(order);

    if (result.added > 0) {
      await this.router.navigateByUrl('/cart');
      return;
    }

    this.reorderMessage.set("None of this order's items are available right now.");
  }
}
