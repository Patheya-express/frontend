import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ApiConfiguration,
  RestaurantReportsService as SdkRestaurantReportsService,
  type ReportResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { RestaurantContextService } from '@patheya-express-frontend/core';

// The API gateway wraps every response in a { success, timestamp, data } envelope via a
// global interceptor that Swagger/the generated SDK types do not account for.
interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

export type ReportType =
  | 'daily-sales'
  | 'orders'
  | 'revenue'
  | 'tax-summary'
  | 'payment-summary'
  | 'cancelled-orders'
  | 'refund-summary';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  status?: string;
  paymentMode?: string;
}

/** Stateless backend orchestration for the restaurant-app Reports screen. */
@Injectable({ providedIn: 'root' })
export class RestaurantReportsService {
  private readonly reportsApi = inject(SdkRestaurantReportsService);
  private readonly currentRestaurant = inject(RestaurantContextService);
  private readonly apiConfiguration = inject(ApiConfiguration);
  // Exception to this codebase's "no HttpClient in feature services" convention, and a
  // deliberate one: the generated SDK's report methods hardcode `responseType: 'json'` (ng-
  // openapi-gen has no per-endpoint way to express "this route returns a file depending on a
  // query param"), so calling them with format=csv/xlsx/pdf would try to JSON-parse a binary
  // body and corrupt it. Only downloadReport() below uses HttpClient directly, with
  // `responseType: 'blob'`; every JSON preview call still goes through the generated SDK
  // normally. The global authInterceptor still attaches the Bearer token to this request the
  // same as any generated-SDK call, since it's registered on HttpClient itself, not per-service.
  private readonly http = inject(HttpClient);

  async getReport(type: ReportType, filters: ReportFilters): Promise<ReportResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const params = {
      restaurantId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      branchId: filters.branchId,
      format: 'json' as const,
    };

    switch (type) {
      case 'daily-sales':
        return unwrap(await this.reportsApi.reportsControllerDailySales(params));
      case 'orders':
        return unwrap(
          await this.reportsApi.reportsControllerOrders({
            ...params,
            status: filters.status as never,
          }),
        );
      case 'revenue':
        return unwrap(await this.reportsApi.reportsControllerRevenue(params));
      case 'tax-summary':
        return unwrap(await this.reportsApi.reportsControllerTaxSummary(params));
      case 'payment-summary':
        return unwrap(
          await this.reportsApi.reportsControllerPaymentSummary({
            ...params,
            paymentMode: filters.paymentMode as never,
          }),
        );
      case 'cancelled-orders':
        return unwrap(await this.reportsApi.reportsControllerCancelledOrders(params));
      case 'refund-summary':
        return unwrap(await this.reportsApi.reportsControllerRefundSummary(params));
    }
  }

  async downloadReport(type: ReportType, filters: ReportFilters, format: ExportFormat): Promise<Blob> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();

    const params: Record<string, string> = { format };
    if (filters.dateFrom) params['dateFrom'] = filters.dateFrom;
    if (filters.dateTo) params['dateTo'] = filters.dateTo;
    if (filters.branchId) params['branchId'] = filters.branchId;
    if (filters.status) params['status'] = filters.status;
    if (filters.paymentMode) params['paymentMode'] = filters.paymentMode;

    const query = new URLSearchParams(params).toString();
    const url = `${this.apiConfiguration.rootUrl}/api/v1/reports/${restaurantId}/${type}?${query}`;

    return firstValueFrom(this.http.get(url, { responseType: 'blob' }));
  }
}
