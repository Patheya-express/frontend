import { Injectable, inject } from '@angular/core';
import {
  PaymentsService,
  OrdersService,
  type AdminPaymentResponseDto,
  type OrderResponseDto,
  type PaginatedAdminPaymentsResponseDto,
} from '@patheya-express-frontend/api-sdk';

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

export interface GetAdminPaymentsQuery {
  page: number;
  limit: number;
  search?: string;
  status?: AdminPaymentResponseDto['status'];
  provider?: AdminPaymentResponseDto['provider'];
  method?: AdminPaymentResponseDto['method'];
  dateFrom?: string;
  dateTo?: string;
}

/** Stateless backend orchestration for the admin payment management list. */
@Injectable({ providedIn: 'root' })
export class AdminPaymentsService {
  private readonly paymentsService = inject(PaymentsService);
  private readonly ordersService = inject(OrdersService);

  async getPayments(query: GetAdminPaymentsQuery): Promise<PaginatedAdminPaymentsResponseDto> {
    const response = await this.paymentsService.paymentsControllerGetAllForAdmin(query);
    return unwrap(response);
  }

  /**
   * Reuses the admin order-refund endpoint (POST /orders/:id/refund) — it resolves the order's
   * active payment, calls the payment provider, and keeps Order.paymentStatus in sync, none of
   * which the raw POST /payments/refund does. No refund logic is duplicated here.
   */
  async refundPayment(orderId: string, amount?: number, reason?: string): Promise<OrderResponseDto> {
    const response = await this.ordersService.ordersControllerRefundOrder({
      id: orderId,
      body: { amount, reason },
    });
    return unwrap(response);
  }
}
