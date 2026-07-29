import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import {
  DataTableComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PrimaryButtonComponent,
  SecondaryButtonComponent,
  SkeletonComponent,
  type DataTableColumn,
} from '@patheya-express-frontend/ui';
import { RestaurantContextService } from '@patheya-express-frontend/core';
import { RestaurantReportsFacade } from '../../facades/restaurant-reports.facade';
import type { ExportFormat, ReportType } from '../../services/restaurant-reports.service';

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'daily-sales', label: 'Daily Sales' },
  { value: 'orders', label: 'Orders' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'tax-summary', label: 'Tax Summary' },
  { value: 'payment-summary', label: 'Payment Summary' },
  { value: 'cancelled-orders', label: 'Cancelled Orders' },
  { value: 'refund-summary', label: 'Refund Summary' },
];

const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

const PAYMENT_MODES = ['ONLINE', 'COD'];

@Component({
  selector: 'lib-report-page',
  standalone: true,
  imports: [
    DataTableComponent,
    SkeletonComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    PrimaryButtonComponent,
    SecondaryButtonComponent,
  ],
  templateUrl: './report-page.component.html',
  styleUrl: './report-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportPageComponent implements OnInit {
  protected readonly facade = inject(RestaurantReportsFacade);
  protected readonly context = inject(RestaurantContextService);

  protected readonly reportTypes = REPORT_TYPES;
  protected readonly orderStatuses = ORDER_STATUSES;
  protected readonly paymentModes = PAYMENT_MODES;

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected retry(): void {
    void this.facade.refresh();
  }

  protected get columns(): DataTableColumn[] {
    return this.facade.reports()?.columns ?? [];
  }

  // The generated SDK types `rows` as `Array<{}>` (it's a dynamic, column-driven shape the
  // OpenAPI schema can't express statically), so this getter re-asserts the runtime contract
  // documented on ReportResponseDto.rows: one object per row, keyed by each column's `key`.
  protected get rows(): Record<string, string | number | null>[] {
    return (this.facade.reports()?.rows ?? []) as Record<string, string | number | null>[];
  }

  protected onReportTypeChange(reportType: ReportType): void {
    this.facade.setReportType(reportType);
  }

  protected onDateFromChange(value: string): void {
    this.facade.setFilters({ dateFrom: value || null });
  }

  protected onDateToChange(value: string): void {
    this.facade.setFilters({ dateTo: value || null });
  }

  protected onBranchChange(branchId: string): void {
    this.facade.setFilters({ branchId: branchId || null });
  }

  protected onStatusChange(status: string): void {
    this.facade.setFilters({ status: status || null });
  }

  protected onPaymentModeChange(paymentMode: string): void {
    this.facade.setFilters({ paymentMode: paymentMode || null });
  }

  protected applyFilters(): void {
    void this.facade.generate();
  }

  protected export(format: ExportFormat): void {
    void this.facade.exportReport(format);
  }

  protected isExporting(format: ExportFormat): boolean {
    return this.facade.exportingFormat() === format;
  }

  protected dismissExportError(): void {
    this.facade.dismissExportError();
  }
}
