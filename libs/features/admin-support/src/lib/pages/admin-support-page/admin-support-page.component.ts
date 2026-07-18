import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DataTableComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PaginationComponent,
  SearchInputComponent,
  SkeletonComponent,
  StatusChipComponent,
  TableToolbarComponent,
  type DataTableColumn,
  type StatusChipTone,
} from '@patheya-express-frontend/ui';
import { AdminSupportFacade } from '../../facades/admin-support.facade';
import type {
  AdminTicketCategoryFilter,
  AdminTicketPriorityFilter,
  AdminTicketStatusFilter,
} from '../../services/admin-support.service';

const COLUMNS: DataTableColumn[] = [
  { key: 'ticket', label: 'Ticket' },
  { key: 'customer', label: 'Customer' },
  { key: 'category', label: 'Category' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'created', label: 'Created' },
  { key: 'actions', label: 'Actions' },
];

const STATUS_OPTIONS: AdminTicketStatusFilter[] = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED'];
const PRIORITY_OPTIONS: AdminTicketPriorityFilter[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const CATEGORY_OPTIONS: AdminTicketCategoryFilter[] = [
  'ORDER_ISSUE',
  'PAYMENT_ISSUE',
  'REFUND_REQUEST',
  'CANCELLATION_REQUEST',
  'ACCOUNT_ISSUE',
  'GENERAL',
];

const PRIORITY_TONES: Record<AdminTicketPriorityFilter, StatusChipTone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'error',
  URGENT: 'error',
};

const STATUS_TONES: Record<AdminTicketStatusFilter, StatusChipTone> = {
  OPEN: 'info',
  IN_PROGRESS: 'info',
  WAITING_ON_CUSTOMER: 'neutral',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

@Component({
  selector: 'lib-admin-support-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    SkeletonComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    TableToolbarComponent,
    SearchInputComponent,
    DataTableComponent,
    StatusChipComponent,
    PaginationComponent,
  ],
  templateUrl: './admin-support-page.component.html',
  styleUrl: './admin-support-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSupportPageComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(AdminSupportFacade);

  protected readonly columns = COLUMNS;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly priorityOptions = PRIORITY_OPTIONS;
  protected readonly categoryOptions = CATEGORY_OPTIONS;

  protected readonly draftMessage = signal('');

  ngOnInit(): void {
    void this.facade.loadTickets();
  }

  ngOnDestroy(): void {
    if (this.facade.online()) {
      void this.facade.toggleOnline();
    }
  }

  protected retry(): void {
    void this.facade.loadTickets(this.facade.pagination().page);
  }

  protected onSearch(value: string): void {
    this.facade.setSearch(value);
  }

  protected onStatusChange(value: string): void {
    this.facade.setStatusFilter((value || null) as AdminTicketStatusFilter | null);
  }

  protected onCategoryChange(value: string): void {
    this.facade.setCategoryFilter((value || null) as AdminTicketCategoryFilter | null);
  }

  protected onPriorityChange(value: string): void {
    this.facade.setPriorityFilter((value || null) as AdminTicketPriorityFilter | null);
  }

  protected onUnassignedToggle(checked: boolean): void {
    this.facade.setUnassignedOnly(checked);
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected toggleOnline(): void {
    void this.facade.toggleOnline();
  }

  protected openTicket(ticketId: string): void {
    void this.facade.selectTicket(ticketId);
  }

  protected closeDetail(): void {
    this.facade.closeSelectedTicket();
  }

  protected assignToMe(ticketId: string): void {
    void this.facade.assignToMe(ticketId);
  }

  protected onStatusUpdate(ticketId: string, value: string): void {
    void this.facade.updateStatus(ticketId, value as AdminTicketStatusFilter);
  }

  protected onPriorityUpdate(ticketId: string, value: string): void {
    void this.facade.updatePriority(ticketId, value as AdminTicketPriorityFilter);
  }

  protected async sendReply(ticketId: string): Promise<void> {
    const message = this.draftMessage().trim();

    if (!message) {
      return;
    }

    await this.facade.postMessage(ticketId, message);
    this.draftMessage.set('');
  }

  protected priorityTone(priority: AdminTicketPriorityFilter): StatusChipTone {
    return PRIORITY_TONES[priority];
  }

  protected statusTone(status: AdminTicketStatusFilter): StatusChipTone {
    return STATUS_TONES[status];
  }

  protected customerName(ticket: { customer: { firstName: string; lastName?: string } }): string {
    return [ticket.customer.firstName, ticket.customer.lastName].filter(Boolean).join(' ');
  }
}
