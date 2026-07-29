import { Injectable, inject } from '@angular/core';
import { RestaurantReportsStore, type ReportFiltersState } from '../store/restaurant-reports.store';
import type { ExportFormat, ReportType } from '../services/restaurant-reports.service';

@Injectable({ providedIn: 'root' })
export class RestaurantReportsFacade {
  private readonly store = inject(RestaurantReportsStore);

  readonly reports = this.store.reports;
  readonly filters = this.store.filters;
  readonly reportTypeLabel = this.store.reportTypeLabel;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly exporting = this.store.exporting;
  readonly exportingFormat = this.store.exportingFormat;
  readonly exportError = this.store.exportError;
  readonly validationErrors = this.store.validationErrors;

  initialize(): Promise<void> {
    return this.store.generate();
  }

  refresh(): Promise<void> {
    return this.store.generate();
  }

  setReportType(reportType: ReportType): void {
    this.store.setReportType(reportType);
  }

  setFilters(partial: Partial<Omit<ReportFiltersState, 'reportType'>>): void {
    this.store.setFilters(partial);
  }

  generate(): Promise<void> {
    return this.store.generate();
  }

  exportReport(format: ExportFormat): Promise<void> {
    return this.store.exportReport(format);
  }

  dismissExportError(): void {
    this.store.dismissExportError();
  }
}
