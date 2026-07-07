import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import type { AdminAuditLogResponseDto } from '@patheya-express-frontend/api-sdk';
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
} from '@patheya-express-frontend/ui';
import { AdminAuditFacade } from '../../facades/admin-audit.facade';
import type { AuditActionFilter } from '../../store/admin-audit.store';

const COLUMNS: DataTableColumn[] = [
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'user', label: 'User' },
  { key: 'action', label: 'Action' },
  { key: 'entity', label: 'Entity' },
  { key: 'entityId', label: 'Entity ID' },
  { key: 'ipAddress', label: 'IP Address' },
  { key: 'result', label: 'Result' },
  { key: 'actions', label: 'Actions' },
];

const ACTION_OPTIONS: { value: AuditActionFilter; label: string }[] = [
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'STATUS_CHANGE', label: 'Status Change' },
  { value: 'APPROVE', label: 'Approve' },
  { value: 'REJECT', label: 'Reject' },
];

@Component({
  selector: 'lib-admin-audit-page',
  standalone: true,
  imports: [
    SkeletonComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    TableToolbarComponent,
    SearchInputComponent,
    DataTableComponent,
    StatusChipComponent,
    PaginationComponent,
  ],
  templateUrl: './admin-audit-page.component.html',
  styleUrl: './admin-audit-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuditPageComponent implements OnInit {
  private readonly facade = inject(AdminAuditFacade);

  protected readonly columns = COLUMNS;
  protected readonly actionOptions = ACTION_OPTIONS;

  protected readonly state = this.facade.state;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected retry(): void {
    void this.facade.refresh();
  }

  protected onSearch(value: string): void {
    this.facade.setSearch(value);
  }

  protected onActionFilterChange(value: string): void {
    this.facade.setActionFilter((value || null) as AuditActionFilter | null);
  }

  protected onEntityTypeFilterChange(value: string): void {
    this.facade.setEntityTypeFilter(value);
  }

  protected onUserFilterChange(value: string): void {
    this.facade.setUserFilter(value);
  }

  protected onDateFromChange(value: string): void {
    this.facade.setDateRange(value, this.state().filters.dateTo);
  }

  protected onDateToChange(value: string): void {
    this.facade.setDateRange(this.state().filters.dateFrom, value);
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected viewDetails(log: AdminAuditLogResponseDto): void {
    this.facade.selectLog(log);
  }

  protected closeDetails(): void {
    this.facade.selectLog(null);
  }

  protected actorName(log: AdminAuditLogResponseDto): string {
    if (!log.actor) {
      return 'System';
    }
    return [log.actor.firstName, log.actor.lastName].filter(Boolean).join(' ');
  }

  protected actionLabel(log: AdminAuditLogResponseDto): string {
    return ACTION_OPTIONS.find((option) => option.value === log.action)?.label ?? log.action;
  }

  protected formattedJson(value: unknown): string {
    if (value === undefined || value === null) {
      return '—';
    }
    return JSON.stringify(value, null, 2);
  }

  protected formattedDate(value: string): string {
    return new Date(value).toLocaleDateString();
  }

  protected formattedDateTime(value: string): string {
    return new Date(value).toLocaleString();
  }
}
