import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  PaginationComponent,
  SkeletonComponent,
  StatusChipComponent,
} from '@patheya-express-frontend/ui';
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
  imports: [RouterLink, SkeletonComponent, EmptyStateComponent, ErrorStateComponent, PaginationComponent, StatusChipComponent],
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

  /** Title-cased for direct display (e.g. "Waiting On Customer") — previously plain-lowercased
   *  text relying on the now-removed `.ticket-item-status`'s `text-transform: capitalize`, which
   *  `lib-status-chip` doesn't apply itself. Produces the exact same visible text as before. */
  protected statusLabel(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
}
