import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent, ErrorStateComponent, PaginationComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { CustomerSupportFacade } from '../../facades/customer-support.facade';
import type { TicketStatus } from '../../services/customer-support.service';

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'WAITING_ON_CUSTOMER', label: 'Waiting on you' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

@Component({
  selector: 'lib-ticket-list-page',
  standalone: true,
  imports: [RouterLink, SkeletonComponent, EmptyStateComponent, ErrorStateComponent, PaginationComponent],
  templateUrl: './ticket-list-page.component.html',
  styleUrl: './ticket-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketListPageComponent implements OnInit {
  protected readonly facade = inject(CustomerSupportFacade);
  protected readonly statusOptions = STATUS_OPTIONS;

  ngOnInit(): void {
    void this.facade.loadTickets();
  }

  protected retry(): void {
    void this.facade.loadTickets(this.facade.page());
  }

  protected onStatusChange(value: string): void {
    this.facade.setStatusFilter(value ? (value as TicketStatus) : undefined);
  }

  protected onPageChange(page: number): void {
    void this.facade.loadTickets(page);
  }

  protected statusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase();
  }
}
