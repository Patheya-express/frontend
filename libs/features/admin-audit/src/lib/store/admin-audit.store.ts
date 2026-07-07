import { Injectable, computed, inject, signal } from '@angular/core';
import type { AdminAuditLogResponseDto } from '@patheya-express-frontend/api-sdk';
import { AdminAuditService } from '../services/admin-audit.service';

export type AuditActionFilter = AdminAuditLogResponseDto['action'];

export interface AdminAuditFilters {
  search: string;
  action: AuditActionFilter | null;
  entityType: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
}

export interface AdminAuditPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminAuditState {
  logs: AdminAuditLogResponseDto[];
  pagination: AdminAuditPagination;
  filters: AdminAuditFilters;
  selectedLog: AdminAuditLogResponseDto | null;
}

const DEFAULT_PAGINATION: AdminAuditPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
const DEFAULT_FILTERS: AdminAuditFilters = {
  search: '',
  action: null,
  entityType: '',
  userId: '',
  dateFrom: '',
  dateTo: '',
};

/**
 * There are no mutating actions on this page — audit logs are read-only history — so unlike
 * every other admin store (transitionUser/transitionRestaurant/transitionOrder/
 * transitionPartner/transitionPayment) there is no processingId/actionError pair and no
 * transition helper. Nothing here needs one.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuditStore {
  private readonly adminAuditService = inject(AdminAuditService);

  private readonly _logs = signal<AdminAuditLogResponseDto[]>([]);
  private readonly _pagination = signal<AdminAuditPagination>(DEFAULT_PAGINATION);
  private readonly _filters = signal<AdminAuditFilters>(DEFAULT_FILTERS);
  private readonly _selectedLog = signal<AdminAuditLogResponseDto | null>(null);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly state = computed<AdminAuditState>(() => ({
    logs: this._logs(),
    pagination: this._pagination(),
    filters: this._filters(),
    selectedLog: this._selectedLog(),
  }));

  async loadLogs(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const filters = this._filters();
      const pagination = this._pagination();

      const response = await this.adminAuditService.getLogs({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search || undefined,
        action: filters.action ?? undefined,
        entityType: filters.entityType || undefined,
        userId: filters.userId || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });

      this._logs.set(response.items);
      this._pagination.set({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: response.totalPages,
      });
    } catch {
      this._error.set('Unable to load audit logs. Please try again.');
      this._logs.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  setSearch(search: string): void {
    this._filters.update((filters) => ({ ...filters, search }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadLogs();
  }

  setActionFilter(action: AuditActionFilter | null): void {
    this._filters.update((filters) => ({ ...filters, action }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadLogs();
  }

  setEntityTypeFilter(entityType: string): void {
    this._filters.update((filters) => ({ ...filters, entityType }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadLogs();
  }

  setUserFilter(userId: string): void {
    this._filters.update((filters) => ({ ...filters, userId }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadLogs();
  }

  setDateRange(dateFrom: string, dateTo: string): void {
    this._filters.update((filters) => ({ ...filters, dateFrom, dateTo }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadLogs();
  }

  setPage(page: number): void {
    this._pagination.update((pagination) => ({ ...pagination, page }));
    void this.loadLogs();
  }

  selectLog(log: AdminAuditLogResponseDto | null): void {
    this._selectedLog.set(log);
  }
}
