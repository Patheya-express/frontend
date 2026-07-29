import { Injectable, computed, inject, signal } from '@angular/core';
import type { ReportResponseDto } from '@patheya-express-frontend/api-sdk';
import {
  RestaurantReportsService,
  type ExportFormat,
  type ReportType,
} from '../services/restaurant-reports.service';

export interface ReportFiltersState {
  reportType: ReportType;
  dateFrom: string | null;
  dateTo: string | null;
  branchId: string | null;
  status: string | null;
  paymentMode: string | null;
}

const DEFAULT_FILTERS: ReportFiltersState = {
  reportType: 'daily-sales',
  dateFrom: null,
  dateTo: null,
  branchId: null,
  status: null,
  paymentMode: null,
};

const REPORT_LABELS: Record<ReportType, string> = {
  'daily-sales': 'Daily Sales Report',
  orders: 'Orders Report',
  revenue: 'Revenue Report',
  'tax-summary': 'Tax Summary',
  'payment-summary': 'Payment Summary',
  'cancelled-orders': 'Cancelled Orders',
  'refund-summary': 'Refund Summary',
};

function validateFilters(filters: ReportFiltersState): string[] {
  const errors: string[] = [];

  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    errors.push('Start date must be before end date.');
  }

  return errors;
}

function extensionFor(format: ExportFormat): string {
  return format === 'xlsx' ? 'xlsx' : format;
}

@Injectable({ providedIn: 'root' })
export class RestaurantReportsStore {
  private readonly service = inject(RestaurantReportsService);

  /** Named `reports` per spec — holds the single currently-generated report (the report-type
   *  selector already picks which one is "active"), not a list of many. */
  private readonly _reports = signal<ReportResponseDto | null>(null);
  private readonly _filters = signal<ReportFiltersState>(DEFAULT_FILTERS);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _exportingFormat = signal<ExportFormat | null>(null);
  private readonly _exportError = signal<string | null>(null);
  private readonly _validationErrors = signal<string[]>([]);

  readonly reports = this._reports.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly exportError = this._exportError.asReadonly();
  readonly validationErrors = this._validationErrors.asReadonly();
  readonly exporting = computed(() => this._exportingFormat() !== null);
  readonly exportingFormat = this._exportingFormat.asReadonly();

  readonly reportTypeLabel = computed(() => REPORT_LABELS[this._filters().reportType]);

  setReportType(reportType: ReportType): void {
    this._filters.update((filters) => ({ ...filters, reportType }));
    this._reports.set(null);
    void this.generate();
  }

  setFilters(partial: Partial<Omit<ReportFiltersState, 'reportType'>>): void {
    this._filters.update((filters) => ({ ...filters, ...partial }));
  }

  dismissExportError(): void {
    this._exportError.set(null);
  }

  async generate(): Promise<void> {
    const filters = this._filters();
    const errors = validateFilters(filters);

    if (errors.length > 0) {
      this._validationErrors.set(errors);
      return;
    }

    this._validationErrors.set([]);
    this._loading.set(true);
    this._error.set(null);

    try {
      const report = await this.service.getReport(filters.reportType, {
        dateFrom: filters.dateFrom ?? undefined,
        dateTo: filters.dateTo ?? undefined,
        branchId: filters.branchId ?? undefined,
        status: filters.status ?? undefined,
        paymentMode: filters.paymentMode ?? undefined,
      });
      this._reports.set(report);
    } catch {
      this._error.set('Unable to generate this report. Please try again.');
      this._reports.set(null);
    } finally {
      this._loading.set(false);
    }
  }

  async exportReport(format: ExportFormat): Promise<void> {
    const filters = this._filters();
    const errors = validateFilters(filters);

    if (errors.length > 0) {
      this._validationErrors.set(errors);
      return;
    }

    this._validationErrors.set([]);
    this._exportingFormat.set(format);
    this._exportError.set(null);

    try {
      const blob = await this.service.downloadReport(
        filters.reportType,
        {
          dateFrom: filters.dateFrom ?? undefined,
          dateTo: filters.dateTo ?? undefined,
          branchId: filters.branchId ?? undefined,
          status: filters.status ?? undefined,
          paymentMode: filters.paymentMode ?? undefined,
        },
        format,
      );

      this.triggerDownload(blob, `${filters.reportType}.${extensionFor(format)}`);
    } catch {
      this._exportError.set('Unable to export this report. Please try again.');
    } finally {
      this._exportingFormat.set(null);
    }
  }

  /** Standard client-side "save this blob as a file" — create a temporary object URL, click a
   *  synthetic anchor, then revoke it. No shared-ui primitive covers this (it's a one-shot
   *  browser API call, not a component). */
  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
