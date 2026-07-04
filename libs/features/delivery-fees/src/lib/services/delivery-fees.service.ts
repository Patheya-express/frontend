import { Injectable, inject } from '@angular/core';
import { DeliveryService, type OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { CurrentDeliveryPartnerService } from '@patheya-express-frontend/core';

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

/** Stateless backend orchestration for a delivery partner's fee/earnings data. */
@Injectable({ providedIn: 'root' })
export class DeliveryFeesService {
  private readonly deliveryService = inject(DeliveryService);
  private readonly currentPartner = inject(CurrentDeliveryPartnerService);

  /**
   * No earnings/commission endpoint exists in the backend. Delivery fee metrics and history
   * are derived entirely from the partner's assigned orders — the same endpoint the dashboard
   * already uses — filtered/sorted by the Store.
   */
  async getDeliveryHistory(): Promise<OrderResponseDto[]> {
    await this.currentPartner.getPartner();
    const response = await this.deliveryService.deliveryControllerGetAssignedOrders();
    return unwrap(response);
  }
}
