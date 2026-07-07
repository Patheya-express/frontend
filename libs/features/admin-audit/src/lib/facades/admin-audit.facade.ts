import { Injectable, inject } from '@angular/core';
import type { AdminAuditLogResponseDto } from '@patheya-express-frontend/api-sdk';
import { AdminAuditStore, type AuditActionFilter } from '../store/admin-audit.store';

@Injectable({ providedIn: 'root' })
export class AdminAuditFacade {
  private readonly store = inject(AdminAuditStore);

  readonly state = this.store.state;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  /** Loads the first page of audit logs. Call once on page init. */
  initialize(): Promise<void> {
    return this.store.loadLogs();
  }

  refresh(): Promise<void> {
    return this.store.loadLogs();
  }

  setSearch(search: string): void {
    this.store.setSearch(search);
  }

  setActionFilter(action: AuditActionFilter | null): void {
    this.store.setActionFilter(action);
  }

  setEntityTypeFilter(entityType: string): void {
    this.store.setEntityTypeFilter(entityType);
  }

  setUserFilter(userId: string): void {
    this.store.setUserFilter(userId);
  }

  setDateRange(dateFrom: string, dateTo: string): void {
    this.store.setDateRange(dateFrom, dateTo);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  selectLog(log: AdminAuditLogResponseDto | null): void {
    this.store.selectLog(log);
  }
}
