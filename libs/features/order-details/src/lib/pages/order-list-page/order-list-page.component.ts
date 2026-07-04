import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import type { OrderStatusHistoryResponseDto } from '@patheya-express-frontend/api-sdk';
import { EmptyStateComponent, ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { OrderListFacade } from '../../facades/order-list.facade';

@Component({
  selector: 'lib-order-list-page',
  standalone: true,
  imports: [RouterLink, DatePipe, SkeletonComponent, EmptyStateComponent, ErrorStateComponent],
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
}
